import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { useActiveSessions, useDeletePlayer, usePlayers, useSavePlayer, type Player } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Empty, IdleBadge, Loading, PageHeader, SeatedBadge } from "@/components/ui-bits";

export const Route = createFileRoute("/players")({
  head: () => ({
    meta: [
      { title: "Players — Tournament Floor" },
      { name: "description", content: "Register, search and manage tournament players." },
      { property: "og:title", content: "Players — Tournament Floor" },
      { property: "og:description", content: "Register, search and manage tournament players." },
    ],
  }),
  component: PlayersPage,
});

const schema = z.object({ full_name: z.string().trim().min(1, "Name is required").max(100) });

function PlayersPage() {
  const players = usePlayers();
  const active = useActiveSessions();
  const del = useDeletePlayer();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Partial<Player> | null>(null);

  const seatedAt = useMemo(() => {
    const m = new Map<string, string>();
    active.data?.forEach((s) => m.set(s.player.id, s.table.name));
    return m;
  }, [active.data]);

  const filtered = (players.data ?? []).filter((p) =>
    p.full_name.toLowerCase().includes(q.trim().toLowerCase()),
  );

  return (
    <>
      <PageHeader
        title="Players"
        subtitle={`${players.data?.length ?? 0} registered`}
        action={
          <Button size="lg" onClick={() => setEditing({})}>
            <Plus /> Add player
          </Button>
        }
      />
      <div className="relative mb-4 max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search players…" className="h-12 pl-9" />
      </div>
      {players.isLoading ? (
        <Loading />
      ) : !filtered.length ? (
        <Empty>{q ? "No players match your search." : "No players yet."}</Empty>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Player</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Table</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const table = seatedAt.get(p.id);
                return (
                  <tr key={p.id} className="border-t">
                    <td className="px-4 py-3 text-base font-semibold">{p.full_name}</td>
                    <td className="px-4 py-3">{table ? <SeatedBadge /> : <IdleBadge />}</td>
                    <td className="px-4 py-3">{table ?? <span className="text-muted-foreground">—</span>}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="icon" aria-label="Edit player" onClick={() => setEditing(p)}>
                          <Pencil />
                        </Button>
                        <ConfirmDialog
                          title={`Delete ${p.full_name}?`}
                          description="This permanently removes the player. Players with play history can't be deleted."
                          onConfirm={() =>
                            del.mutate(p.id, {
                              onSuccess: () => toast.success("Player deleted"),
                              onError: (e) => toast.error(e.message),
                            })
                          }
                          trigger={
                            <Button variant="outline" size="icon" aria-label="Delete player">
                              <Trash2 className="text-destructive" />
                            </Button>
                          }
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <PlayerDialog value={editing} onClose={() => setEditing(null)} />
    </>
  );
}

function PlayerDialog({ value, onClose }: { value: Partial<Player> | null; onClose: () => void }) {
  const save = useSavePlayer();
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog open={!!value} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        {value && (
          <form
            key={value.id ?? "new"}
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const parsed = schema.safeParse({ full_name: new FormData(e.currentTarget).get("full_name") });
              if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Invalid");
              setError(null);
              save.mutate(
                { id: value.id, ...parsed.data },
                {
                  onSuccess: () => {
                    toast.success(value.id ? "Player updated" : "Player added");
                    onClose();
                  },
                  onError: (e) => setError(e.message),
                },
              );
            }}
          >
            <DialogHeader>
              <DialogTitle>{value.id ? "Edit player" : "Add player"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="full_name">Full name</Label>
              <Input id="full_name" name="full_name" defaultValue={value.full_name} placeholder="John Smith" className="h-12" autoFocus />
            </div>
            {error && <p className="text-sm font-medium text-destructive">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" size="lg" disabled={save.isPending}>
                {save.isPending ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

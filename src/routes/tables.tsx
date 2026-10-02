import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { useActiveSessions, useDeleteTable, useSaveTable, useTables, type PokerTable } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Empty, Loading, PageHeader } from "@/components/ui-bits";

export const Route = createFileRoute("/tables")({
  head: () => ({
    meta: [
      { title: "Tables — Tournament Floor" },
      { name: "description", content: "Manage poker tables and game types." },
      { property: "og:title", content: "Tables — Tournament Floor" },
      { property: "og:description", content: "Manage poker tables and game types." },
    ],
  }),
  component: TablesPage,
});

const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  game_type: z.string().trim().min(1, "Game type is required").max(100),
});

function TablesPage() {
  const tables = useTables();
  const active = useActiveSessions();
  const del = useDeleteTable();
  const [editing, setEditing] = useState<Partial<PokerTable> | null>(null);

  const seatedCount = (id: string) => active.data?.filter((s) => s.table.id === id).length ?? 0;

  return (
    <>
      <PageHeader
        title="Tables"
        subtitle="All poker tables in the tournament"
        action={
          <Button size="lg" onClick={() => setEditing({})}>
            <Plus /> Add table
          </Button>
        }
      />
      {tables.isLoading ? (
        <Loading />
      ) : !tables.data?.length ? (
        <Empty>No tables yet. Add your first table.</Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tables.data.map((t) => {
            const n = seatedCount(t.id);
            return (
              <div key={t.id} className="flex flex-col rounded-xl border bg-card p-5 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-xl font-bold">{t.name}</h3>
                    <p className="text-muted-foreground">{t.game_type}</p>
                  </div>
                  <span
                    className={
                      n > 0
                        ? "inline-flex items-center gap-2 rounded-full bg-success/15 px-3 py-1 text-sm font-semibold text-success"
                        : "rounded-full bg-muted px-3 py-1 text-sm text-muted-foreground"
                    }
                  >
                    {n > 0 && <span className="live-dot" />}
                    {n} seated
                  </span>
                </div>
                <div className="mt-5 flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setEditing(t)}>
                    <Pencil /> Edit
                  </Button>
                  <ConfirmDialog
                    title={`Delete ${t.name}?`}
                    description="This permanently removes the table. Tables with play history can't be deleted."
                    onConfirm={() =>
                      del.mutate(t.id, {
                        onSuccess: () => toast.success("Table deleted"),
                        onError: (e) => toast.error(e.message),
                      })
                    }
                    trigger={
                      <Button variant="outline" size="icon" aria-label="Delete table">
                        <Trash2 className="text-destructive" />
                      </Button>
                    }
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
      <TableDialog value={editing} onClose={() => setEditing(null)} />
    </>
  );
}

function TableDialog({ value, onClose }: { value: Partial<PokerTable> | null; onClose: () => void }) {
  const save = useSaveTable();
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog open={!!value} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        {value && (
          <form
            key={value.id ?? "new"}
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const parsed = schema.safeParse({ name: fd.get("name"), game_type: fd.get("game_type") });
              if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Invalid");
              setError(null);
              save.mutate(
                { id: value.id, ...parsed.data },
                {
                  onSuccess: () => {
                    toast.success(value.id ? "Table updated" : "Table added");
                    onClose();
                  },
                  onError: (e) => setError(e.message),
                },
              );
            }}
            className="space-y-4"
          >
            <DialogHeader>
              <DialogTitle>{value.id ? "Edit table" : "Add table"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="name">Table name</Label>
              <Input id="name" name="name" defaultValue={value.name} placeholder="Table 1" className="h-12" autoFocus />
            </div>
            <div className="space-y-2">
              <Label htmlFor="game_type">Game type</Label>
              <Input id="game_type" name="game_type" defaultValue={value.game_type} placeholder="Texas Hold'em" className="h-12" />
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

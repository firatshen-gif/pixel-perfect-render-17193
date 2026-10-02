import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, type FormEvent } from "react";
import { LogOut, Search } from "lucide-react";
import { toast } from "sonner";
import { useActiveSessions, useLeaveTable, usePlayers, useSeatPlayer, useTables, type Session } from "@/lib/api";
import { formatDateTime, formatDuration, fromLocalInput, sessionMs, toLocalInput, useNow } from "@/lib/time";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Combobox } from "@/components/Combobox";
import { Empty, Loading, PageHeader } from "@/components/ui-bits";

export const Route = createFileRoute("/sessions")({
  head: () => ({
    meta: [
      { title: "Seating — Tournament Floor" },
      { name: "description", content: "Seat players at tables and record when they leave." },
      { property: "og:title", content: "Seating — Tournament Floor" },
      { property: "og:description", content: "Seat players at tables and record when they leave." },
    ],
  }),
  component: SessionsPage,
});

function SessionsPage() {
  const active = useActiveSessions();
  const tables = useTables();
  const now = useNow();
  const [q, setQ] = useState("");
  const [tableFilter, setTableFilter] = useState("all");
  const [leaving, setLeaving] = useState<Session | null>(null);

  const list = (active.data ?? []).filter(
    (s) =>
      s.player.full_name.toLowerCase().includes(q.trim().toLowerCase()) &&
      (tableFilter === "all" || s.table.id === tableFilter),
  );

  return (
    <>
      <PageHeader title="Seating" subtitle="Seat players and remove them from tables" />
      <SeatForm />

      <div className="mb-3 mt-10 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-3 text-xl font-bold">
          <span className="live-dot" /> Currently seated
          <span className="tabular text-muted-foreground">({active.data?.length ?? 0})</span>
        </h2>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search player…" className="h-11 pl-9" />
          </div>
          <Select value={tableFilter} onValueChange={setTableFilter}>
            <SelectTrigger className="h-11 w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All tables</SelectItem>
              {tables.data?.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {active.isLoading ? (
        <Loading />
      ) : !list.length ? (
        <Empty>{active.data?.length ? "No seated players match." : "Nobody is seated yet."}</Empty>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {list.map((s) => (
            <div key={s.id} className="flex items-center gap-4 rounded-xl border-l-4 border-l-success border bg-card p-4 shadow-sm">
              <div className="min-w-0 flex-1">
                <div className="truncate text-lg font-bold">{s.player.full_name}</div>
                <div className="text-sm text-muted-foreground">
                  {s.table.name} · {s.table.game_type}
                </div>
                <div className="mt-1 text-xs text-muted-foreground tabular">
                  Since {formatDateTime(s.seated_at)} ·{" "}
                  <span className="font-semibold text-success">{formatDuration(sessionMs(s.seated_at, null, now))}</span>
                </div>
              </div>
              <Button size="lg" variant="outline" onClick={() => setLeaving(s)}>
                <LogOut /> Leave
              </Button>
            </div>
          ))}
        </div>
      )}
      <LeaveDialog session={leaving} onClose={() => setLeaving(null)} />
    </>
  );
}

function SeatForm() {
  const players = usePlayers();
  const tables = useTables();
  const active = useActiveSessions();
  const seat = useSeatPlayer();
  const [playerId, setPlayerId] = useState("");
  const [tableId, setTableId] = useState("");
  const [seatedAt, setSeatedAt] = useState(() => toLocalInput());

  const seatedMap = useMemo(() => {
    const m = new Map<string, string>();
    active.data?.forEach((s) => m.set(s.player.id, s.table.name));
    return m;
  }, [active.data]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!playerId) { toast.error("Choose a player"); return; }
    if (!tableId) { toast.error("Choose a table"); return; }
    if (!seatedAt) { toast.error("Choose a seated time"); return; }
    const name = players.data?.find((p) => p.id === playerId)?.full_name;
    const table = tables.data?.find((t) => t.id === tableId)?.name;
    seat.mutate(
      { player_id: playerId, table_id: tableId, seated_at: fromLocalInput(seatedAt) },
      {
        onSuccess: () => {
          toast.success(`${name} seated at ${table}`);
          setPlayerId("");
          setSeatedAt(toLocalInput());
        },
        onError: (err) => toast.error(err.message),
      },
    );
  };

  return (
    <form onSubmit={submit} className="rounded-xl bg-felt p-5 text-felt-foreground shadow-lg md:p-6">
      <div className="grid gap-4 md:grid-cols-[1.4fr_1fr_1fr_auto] md:items-end">
        <div className="space-y-2">
          <Label>Player</Label>
          <Combobox
            className="bg-card text-card-foreground"
            value={playerId}
            onChange={setPlayerId}
            placeholder="Search player…"
            options={(players.data ?? []).map((p) => ({
              value: p.id,
              label: p.full_name,
              hint: seatedMap.has(p.id) ? `at ${seatedMap.get(p.id)}` : undefined,
            }))}
          />
        </div>
        <div className="space-y-2">
          <Label>Table</Label>
          <Combobox
            className="bg-card text-card-foreground"
            value={tableId}
            onChange={setTableId}
            placeholder="Choose table…"
            options={(tables.data ?? []).map((t) => ({ value: t.id, label: t.name, hint: t.game_type }))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="seated_at">Seated at</Label>
          <Input
            id="seated_at"
            type="datetime-local"
            value={seatedAt}
            onChange={(e) => setSeatedAt(e.target.value)}
            className="h-12 bg-card text-base text-card-foreground"
          />
        </div>
        <Button type="submit" size="lg" disabled={seat.isPending} className="h-12 bg-accent px-8 text-base font-bold text-accent-foreground hover:bg-accent/90">
          {seat.isPending ? "Seating…" : "Seat Player"}
        </Button>
      </div>
    </form>
  );
}

function LeaveDialog({ session, onClose }: { session: Session | null; onClose: () => void }) {
  const leave = useLeaveTable();
  const [leftAt, setLeftAt] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <Dialog
      open={!!session}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent
        onOpenAutoFocus={() => {
          setLeftAt(toLocalInput());
          setError(null);
        }}
      >
        {session && (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!leftAt) return setError("Choose a time");
              const iso = fromLocalInput(leftAt);
              if (new Date(iso) < new Date(session.seated_at))
                return setError("Left time can't be earlier than seated time.");
              leave.mutate(
                { id: session.id, seated_at: session.seated_at, left_at: iso },
                {
                  onSuccess: () => {
                    toast.success(
                      `${session.player.full_name} left ${session.table.name} · ${formatDuration(sessionMs(session.seated_at, iso))}`,
                    );
                    onClose();
                  },
                  onError: (err) => setError(err.message),
                },
              );
            }}
          >
            <DialogHeader>
              <DialogTitle>Leave table</DialogTitle>
            </DialogHeader>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-lg bg-muted p-4 text-sm">
              <dt className="text-muted-foreground">Player</dt>
              <dd className="font-semibold">{session.player.full_name}</dd>
              <dt className="text-muted-foreground">Table</dt>
              <dd>{session.table.name}</dd>
              <dt className="text-muted-foreground">Seated at</dt>
              <dd className="tabular">{formatDateTime(session.seated_at)}</dd>
            </dl>
            <div className="space-y-2">
              <Label htmlFor="left_at">Left at</Label>
              <Input id="left_at" type="datetime-local" value={leftAt} onChange={(e) => setLeftAt(e.target.value)} className="h-12 text-base" />
            </div>
            {error && <p className="text-sm font-medium text-destructive">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" size="lg" disabled={leave.isPending}>
                {leave.isPending ? "Saving…" : "Confirm leave"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

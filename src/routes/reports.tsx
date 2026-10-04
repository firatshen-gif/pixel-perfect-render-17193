import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ChevronRight, Download, Trash2, X } from "lucide-react";
import * as XLSX from "xlsx";
import {
  useCompletedSessions,
  useDeleteSession,
  usePlayers,
  useTables,
  type Session,
} from "@/lib/api";
import {
  formatDateTime,
  formatDuration,
  istanbulDate,
  playMs,
  sessionMs,
  sitOutMs,
  toLocalInput,
} from "@/lib/time";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/Combobox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Empty, Loading, PageHeader } from "@/components/ui-bits";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Reports — Tournament Floor" },
      { name: "description", content: "Completed sessions, player and table playing-time summaries." },
      { property: "og:title", content: "Reports — Tournament Floor" },
      { property: "og:description", content: "Completed sessions, player and table playing-time summaries." },
    ],
  }),
  component: ReportsPage,
});

type Filters = { player: string; table: string; game: string; date: string; from: string; to: string };
const EMPTY: Filters = { player: "", table: "", game: "", date: "", from: "", to: "" };
const EXCEL_EPOCH_DAYS = 25569;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function excelCyprusDate(iso: string | null) {
  if (!iso) return "";

  const local = toLocalInput(new Date(iso));
  const [datePart, timePart] = local.split("T");

  if (!datePart || !timePart) return "";

  const [year = 0, month = 1, day = 1] = datePart
    .split("-")
    .map(Number);

  const [hour = 0, minute = 0] = timePart
    .split(":")
    .map(Number);

  const localAsUtc = Date.UTC(
    year,
    month - 1,
    day,
    hour,
    minute,
  );

  return localAsUtc / MS_PER_DAY + EXCEL_EPOCH_DAYS;
}

function excelDuration(ms: number) {
  return ms / MS_PER_DAY;
}


function ReportsPage() {
  const sessions = useCompletedSessions();
  const players = usePlayers();
  const tables = useTables();
  const [f, setF] = useState<Filters>(EMPTY);
  const [detail, setDetail] = useState<string | null>(null);
  const [tab, setTab] = useState("sessions");
  const [deletingSession, setDeletingSession] = useState<Session | null>(null);

  const games = useMemo(
    () => Array.from(new Set((tables.data ?? []).map((t) => t.game_type))).sort(),
    [tables.data],
  );

  const filtered = useMemo(
    () =>
      (sessions.data ?? []).filter((s) => {
        const d = istanbulDate(s.seated_at);
        return (
          (!f.player || s.player.id === f.player) &&
          (!f.table || s.table.id === f.table) &&
          (!f.game || s.table.game_type === f.game) &&
          (!f.date || d === f.date) &&
          (!f.from || d >= f.from) &&
          (!f.to || d <= f.to)
        );
      }),
    [sessions.data, f],
  );

  const playerSummary = useMemo(() => {
    const m = new Map<
      string,
      { id: string; name: string; totalMs: number; sitoutMs: number; playMs: number; n: number }
    >();

    filtered.forEach((s) => {
      const r = m.get(s.player.id) ?? {
        id: s.player.id,
        name: s.player.full_name,
        totalMs: 0,
        sitoutMs: 0,
        playMs: 0,
        n: 0,
      };

      r.totalMs += sessionMs(s.seated_at, s.left_at);
      r.sitoutMs += sitOutMs(s.sitouts);
      r.playMs += playMs(s.seated_at, s.left_at, s.sitouts);
      r.n += 1;
      m.set(s.player.id, r);
    });

    return [...m.values()].sort((a, b) => b.playMs - a.playMs);
  }, [filtered]);

  const tableSummary = useMemo(() => {
    const m = new Map<
      string,
      {
        name: string;
        game: string;
        totalMs: number;
        sitoutMs: number;
        playMs: number;
        n: number;
        players: Set<string>;
      }
    >();

    filtered.forEach((s) => {
      const r = m.get(s.table.id) ?? {
        name: s.table.name,
        game: s.table.game_type,
        totalMs: 0,
        sitoutMs: 0,
        playMs: 0,
        n: 0,
        players: new Set<string>(),
      };

      r.totalMs += sessionMs(s.seated_at, s.left_at);
      r.sitoutMs += sitOutMs(s.sitouts);
      r.playMs += playMs(s.seated_at, s.left_at, s.sitouts);
      r.n += 1;
      r.players.add(s.player.id);
      m.set(s.table.id, r);
    });

    return [...m.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [filtered]);

  const totalMs = filtered.reduce(
    (sum, s) => sum + playMs(s.seated_at, s.left_at, s.sitouts),
    0,
  );
  const set = (k: keyof Filters) => (v: string) => setF((p) => ({ ...p, [k]: v }));
  const active = Object.values(f).some(Boolean);

const exportExcel = () => {
  let rows: Record<string, string | number>[];
  let sheetName: string;

  if (tab === "players") {
    sheetName = "By player";

    rows = playerSummary.map((r) => ({
      Player: r.name,
      "Total time": excelDuration(r.totalMs),
      "Sit-out time": excelDuration(r.sitoutMs),
      "Play time": excelDuration(r.playMs),
      Sessions: r.n,
    }));
  } else if (tab === "tables") {
    sheetName = "By table";

    rows = tableSummary.map((r) => ({
      Table: r.name,
      Game: r.game,
      "Total time": excelDuration(r.totalMs),
      "Sit-out time": excelDuration(r.sitoutMs),
      "Play time": excelDuration(r.playMs),
      Sessions: r.n,
      "Unique players": r.players.size,
    }));
  } else {
    sheetName = "Sessions";

    rows = filtered.map((s) => ({
      Player: s.player.full_name,
      Table: s.table.name,
      Game: s.table.game_type,
      Seated: excelCyprusDate(s.seated_at),
      Left: excelCyprusDate(s.left_at),
      "Total time": excelDuration(
        sessionMs(s.seated_at, s.left_at),
      ),
      "Sit-out time": excelDuration(sitOutMs(s.sitouts)),
      "Play time": excelDuration(
        playMs(s.seated_at, s.left_at, s.sitouts),
      ),
    }));
  }

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);

  // Apply real Excel number/date formats.
  for (let row = 2; row <= rows.length + 1; row++) {
    if (tab === "players") {
      for (const column of ["B", "C", "D"]) {
        const cell = ws[`${column}${row}`];
        if (cell) cell.z = "[h]:mm";
      }
    } else if (tab === "tables") {
      for (const column of ["C", "D", "E"]) {
        const cell = ws[`${column}${row}`];
        if (cell) cell.z = "[h]:mm";
      }
    } else {
      const seatedCell = ws[`D${row}`];
      const leftCell = ws[`E${row}`];

      if (seatedCell) seatedCell.z = "dd.mm.yyyy hh:mm";
      if (leftCell) leftCell.z = "dd.mm.yyyy hh:mm";

      for (const column of ["F", "G", "H"]) {
        const cell = ws[`${column}${row}`];
        if (cell) cell.z = "[h]:mm";
      }
    }
  }

  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  XLSX.writeFile(
    wb,
    `reports-${sheetName
      .toLowerCase()
      .replace(/\s+/g, "-")}-${istanbulDate(
      new Date().toISOString(),
    )}.xlsx`,
  );
};

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle={`${filtered.length} completed sessions · ${formatDuration(totalMs)} total play`}
        action={
          <Button variant="outline" onClick={exportExcel} disabled={!filtered.length}>
            <Download /> Export Excel
          </Button>
        }
      />

      <div className="mb-6 grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        <div className="space-y-1.5 lg:col-span-2">
          <Label>Player</Label>
          <Combobox value={f.player} onChange={set("player")} placeholder="All players" clearLabel="All players" className="h-11"
            options={(players.data ?? []).map((p) => ({ value: p.id, label: p.full_name }))} />
        </div>
        <div className="space-y-1.5">
          <Label>Table</Label>
          <Combobox value={f.table} onChange={set("table")} placeholder="All tables" clearLabel="All tables" className="h-11"
            options={(tables.data ?? []).map((t) => ({ value: t.id, label: t.name }))} />
        </div>
        <div className="space-y-1.5">
          <Label>Game type</Label>
          <Combobox value={f.game} onChange={set("game")} placeholder="All games" clearLabel="All games" className="h-11"
            options={games.map((g) => ({ value: g, label: g }))} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="date">Date</Label>
          <Input id="date" type="date" value={f.date} onChange={(e) => set("date")(e.target.value)} className="h-11" />
        </div>
        <div className="min-w-0 space-y-1.5 lg:col-span-2">
          <Label>Date range</Label>
          <div className="grid grid-cols-2 gap-1">
            <Input
              type="date"
              aria-label="From"
              value={f.from}
              onChange={(e) => set("from")(e.target.value)}
              className="h-11 min-w-0 px-2"
            />

            <Input
              type="date"
              aria-label="To"
              value={f.to}
              onChange={(e) => set("to")(e.target.value)}
              className="h-11 min-w-0 px-2"
            />
          </div>
        </div>
        {active && (
          <div className="lg:col-span-4 xl:col-span-7">
            <Button variant="ghost" size="sm" onClick={() => setF(EMPTY)}>
              <X /> Clear filters
            </Button>
          </div>
        )}
      </div>

      {sessions.isLoading ? (
        <Loading />
      ) : (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-4 h-11">
            <TabsTrigger value="sessions" className="px-4">Sessions</TabsTrigger>
            <TabsTrigger value="players" className="px-4">By player</TabsTrigger>
            <TabsTrigger value="tables" className="px-4">By table</TabsTrigger>
          </TabsList>

          <TabsContent value="sessions">
            <SessionTable
              sessions={filtered}
              onDelete={setDeletingSession}
            />
          </TabsContent>

          <TabsContent value="players">
            {!playerSummary.length ? <Empty>No data.</Empty> : (
              <div className="overflow-x-auto rounded-xl border bg-card">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Player</th>
                      <th className="px-4 py-3 text-right">Total time</th>
                      <th className="px-4 py-3 text-right">Sit-out</th>
                      <th className="px-4 py-3 text-right">Play time</th>
                      <th className="px-4 py-3 text-right">Sessions</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {playerSummary.map((r) => (
                      <tr key={r.id} className="cursor-pointer border-t hover:bg-muted/60" onClick={() => setDetail(r.id)}>
                        <td className="px-4 py-3 font-semibold">{r.name}</td>
                        <td className="px-4 py-3 text-right tabular">{formatDuration(r.totalMs)}</td>
                        <td className="px-4 py-3 text-right tabular">{formatDuration(r.sitoutMs)}</td>
                        <td className="px-4 py-3 text-right font-semibold tabular">{formatDuration(r.playMs)}</td>
                        <td className="px-4 py-3 text-right tabular">{r.n}</td>
                        <td className="pr-3"><ChevronRight className="h-4 w-4 text-muted-foreground" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="tables">
            {!tableSummary.length ? <Empty>No data.</Empty> : (
              <div className="overflow-x-auto rounded-xl border bg-card">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Table</th>
                      <th className="px-4 py-3">Game</th>
                      <th className="px-4 py-3 text-right">Total time</th>
                      <th className="px-4 py-3 text-right">Sit-out</th>
                      <th className="px-4 py-3 text-right">Play time</th>
                      <th className="px-4 py-3 text-right">Sessions</th>
                      <th className="px-4 py-3 text-right">Unique players</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableSummary.map((r) => (
                      <tr key={r.name} className="border-t">
                        <td className="px-4 py-3 font-semibold">{r.name}</td>
                        <td className="px-4 py-3 text-muted-foreground">{r.game}</td>
                        <td className="px-4 py-3 text-right tabular">{formatDuration(r.totalMs)}</td>
                        <td className="px-4 py-3 text-right tabular">{formatDuration(r.sitoutMs)}</td>
                        <td className="px-4 py-3 text-right font-semibold tabular">{formatDuration(r.playMs)}</td>
                        <td className="px-4 py-3 text-right tabular">{r.n}</td>
                        <td className="px-4 py-3 text-right tabular">{r.players.size}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{playerSummary.find((p) => p.id === detail)?.name} — sessions</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-auto">
            <SessionTable
              sessions={filtered.filter((s) => s.player.id === detail)}
              hidePlayer
              onDelete={setDeletingSession}
            />
          </div>
        </DialogContent>
      </Dialog>
      <DeleteReportSessionDialog
  session={deletingSession}
  onClose={() => setDeletingSession(null)}
/>
    </>
  );
}
function DeleteReportSessionDialog({
  session,
  onClose,
}: {
  session: Session | null;
  onClose: () => void;
}) {
  const deleteSession = useDeleteSession();

  return (
    <AlertDialog
      open={!!session}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Delete session?
          </AlertDialogTitle>

          <AlertDialogDescription>
            {session
              ? `This will permanently delete ${session.player.full_name}'s session at ${session.table.name}. This action cannot be undone.`
              : ""}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel>
            Cancel
          </AlertDialogCancel>

          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={deleteSession.isPending}
            onClick={(event) => {
              event.preventDefault();

              if (!session) return;

              deleteSession.mutate(session.id, {
                onSuccess: () => {
                  toast.success(
                    `${session.player.full_name}'s session deleted`,
                  );

                  onClose();
                },

                onError: (error) => {
                  toast.error(error.message);
                },
              });
            }}
          >
            {deleteSession.isPending
              ? "Deleting…"
              : "Delete Session"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
function SessionTable({
  sessions,
  hidePlayer,
  onDelete,
}: {
  sessions: Session[];
  hidePlayer?: boolean;
  onDelete: (session: Session) => void;
}) {
  if (!sessions.length) return <Empty>No completed sessions match these filters.</Empty>;
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full text-left text-sm">
        <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            {!hidePlayer && <th className="px-4 py-3">Player</th>}
            <th className="px-4 py-3">Table</th>
            <th className="px-4 py-3">Game</th>
            <th className="px-4 py-3">Seated</th>
            <th className="px-4 py-3">Left</th>
            <th className="px-4 py-3 text-right">Total time</th>
            <th className="px-4 py-3 text-right">Sit-out</th>
            <th className="px-4 py-3 text-right">Play time</th>
            <th className="w-12 px-2 py-3" />
          </tr>
        </thead>
        <tbody>
          {sessions.map((s) => (
            <tr key={s.id} className="border-t">
              {!hidePlayer && <td className="px-4 py-3 font-semibold">{s.player.full_name}</td>}
              <td className="px-4 py-3">{s.table.name}</td>
              <td className="px-4 py-3 text-muted-foreground">{s.table.game_type}</td>
              <td className="whitespace-nowrap px-4 py-3 tabular">{formatDateTime(s.seated_at)}</td>
              <td className="whitespace-nowrap px-4 py-3 tabular">{formatDateTime(s.left_at)}</td>
              <td className="px-4 py-3 text-right tabular">{formatDuration(sessionMs(s.seated_at, s.left_at))}</td>
              <td className="px-4 py-3 text-right tabular">{formatDuration(sitOutMs(s.sitouts))}</td>
              <td className="px-4 py-3 text-right font-semibold tabular">{formatDuration(playMs(s.seated_at, s.left_at, s.sitouts))}</td>
              <td className="px-2 py-3 text-right">
  <Button
    size="icon"
    variant="ghost"
    className="h-8 w-8 text-destructive hover:text-destructive"
    title="Delete session"
    aria-label={`Delete ${s.player.full_name}'s session`}
    onClick={() => onDelete(s)}
  >
    <Trash2 className="h-4 w-4" />
  </Button>
</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

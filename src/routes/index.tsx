import { createFileRoute, Link } from "@tanstack/react-router";
import { Users, Grid3x3, Armchair, CheckCircle2 } from "lucide-react";
import { useActiveSessions, useCompletedSessions, usePlayers, useTables } from "@/lib/api";
import { formatDateTime, formatDuration, sessionMs, useNow } from "@/lib/time";
import { Empty, Loading, PageHeader } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Tournament Floor" },
      { name: "description", content: "Live overview of players, tables and seated sessions." },
      { property: "og:title", content: "Dashboard — Tournament Floor" },
      { property: "og:description", content: "Live overview of players, tables and seated sessions." },
    ],
  }),
  component: Dashboard,
});

function Stat({ label, value, icon: Icon, live }: { label: string; value: number | string; icon: typeof Users; live?: boolean }) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between text-sm font-medium text-muted-foreground">
        {label}
        <Icon className="h-5 w-5" />
      </div>
      <div className="mt-2 flex items-center gap-3 text-4xl font-extrabold tabular">
        {live && <span className="live-dot" />}
        {value}
      </div>
    </div>
  );
}

function Dashboard() {
  const players = usePlayers();
  const tables = useTables();
  const active = useActiveSessions();
  const completed = useCompletedSessions();
  const now = useNow();

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Live tournament overview"
        action={
          <Button asChild size="lg">
            <Link to="/sessions">Seat a player</Link>
          </Button>
        }
      />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Total players" value={players.data?.length ?? "–"} icon={Users} />
        <Stat label="Total tables" value={tables.data?.length ?? "–"} icon={Grid3x3} />
        <Stat label="Seated now" value={active.data?.length ?? "–"} icon={Armchair} live />
        <Stat label="Completed sessions" value={completed.data?.length ?? "–"} icon={CheckCircle2} />
      </div>

      <h2 className="mb-3 mt-10 text-xl font-bold">Currently seated</h2>
      {active.isLoading ? (
        <Loading />
      ) : !active.data?.length ? (
        <Empty>No players are seated right now.</Empty>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Player</th>
                <th className="px-4 py-3">Table</th>
                <th className="px-4 py-3">Game</th>
                <th className="px-4 py-3">Seated</th>
                <th className="px-4 py-3 text-right">Playing</th>
              </tr>
            </thead>
            <tbody>
              {active.data.map((s) => (
                <tr key={s.id} className="border-t">
                  <td className="px-4 py-3 font-semibold">
                    <span className="mr-2 live-dot align-middle" />
                    {s.player.full_name}
                  </td>
                  <td className="px-4 py-3">{s.table.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{s.table.game_type}</td>
                  <td className="px-4 py-3 tabular">{formatDateTime(s.seated_at)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-success tabular">
                    {formatDuration(sessionMs(s.seated_at, null, now))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

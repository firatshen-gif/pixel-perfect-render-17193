import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import {
  useActiveSessions,
  usePlayers,
  useSeatPlayer,
  useTables,
  type PokerTable,
} from "@/lib/api";

import {
  formatLiveDuration,
  fromLocalInput,
  sessionMs,
  toLocalInput,
  useNow,
} from "@/lib/time";

import { Combobox } from "@/components/Combobox";
import { Empty, Loading, PageHeader } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Tournament Floor" },
      {
        name: "description",
        content: "Live overview of tournament tables and seated players.",
      },
      {
        property: "og:title",
        content: "Dashboard — Tournament Floor",
      },
      {
        property: "og:description",
        content: "Live overview of tournament tables and seated players.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const tables = useTables();
  const active = useActiveSessions();

  // Update the visible session timers every second.
  const now = useNow(1000);

  const [seatingTable, setSeatingTable] = useState<PokerTable | null>(null);

  if (tables.isLoading || active.isLoading) {
    return (
      <>
        <PageHeader
          title="Dashboard"
          subtitle="Live tournament floor"
        />
        <Loading />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Live tournament floor"
      />

      {!tables.data?.length ? (
        <Empty>No tables have been created yet.</Empty>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {tables.data.map((table) => {
            const seatedPlayers = (active.data ?? []).filter(
              (session) => session.table.id === table.id,
            );

            return (
              <div
                key={table.id}
                className="flex min-h-64 flex-col rounded-xl border bg-card shadow-sm"
              >
                {/* Table header */}
                <div className="border-b px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-bold">
                        {table.name}
                      </h2>

                      <p className="mt-1 text-sm text-muted-foreground">
                        {table.game_type}
                      </p>
                    </div>

                    <div className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
                      {seatedPlayers.length}{" "}
                      {seatedPlayers.length === 1 ? "player" : "players"}
                    </div>
                  </div>
                </div>

                {/* Seated players */}
                <div className="flex-1 p-4">
                  {!seatedPlayers.length ? (
                    <div className="flex h-full min-h-24 items-center justify-center text-sm text-muted-foreground">
                      No players seated
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {seatedPlayers.map((session) => (
                        <div
                          key={session.id}
                          className="flex items-center justify-between gap-4 rounded-lg bg-muted/50 px-3 py-3"
                        >
                          <div className="min-w-0 flex items-center gap-2">
                            <span className="live-dot shrink-0" />

                            <span className="truncate font-semibold">
                              {session.player.full_name}
                            </span>
                          </div>

                          <span className="shrink-0 font-mono text-sm font-bold tabular-nums text-success">
                            {formatLiveDuration(
                              sessionMs(
                                session.seated_at,
                                null,
                                now,
                              ),
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Seat player */}
                <div className="border-t p-4">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setSeatingTable(table)}
                  >
                    <Plus className="h-4 w-4" />
                    Seat Player
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <SeatAtTableDialog
        table={seatingTable}
        onClose={() => setSeatingTable(null)}
      />
    </>
  );
}

function SeatAtTableDialog({
  table,
  onClose,
}: {
  table: PokerTable | null;
  onClose: () => void;
}) {
  const players = usePlayers();
  const active = useActiveSessions();
  const seat = useSeatPlayer();

  const [playerId, setPlayerId] = useState("");
  const [seatedAt, setSeatedAt] = useState(() => toLocalInput());

  const playerOptions = (players.data ?? []).map((player) => {
    const currentSession = active.data?.find(
      (session) => session.player.id === player.id,
    );

    return {
      value: player.id,
      label: player.full_name,
      hint: currentSession
        ? `at ${currentSession.table.name}`
        : undefined,
      disabled: !!currentSession,
    };
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();

    if (!table) return;

    if (!playerId) {
      toast.error("Choose a player");
      return;
    }

    if (!seatedAt) {
      toast.error("Choose a seated time");
      return;
    }

    const playerName = players.data?.find(
      (player) => player.id === playerId,
    )?.full_name;

    seat.mutate(
      {
        player_id: playerId,
        table_id: table.id,
        seated_at: fromLocalInput(seatedAt),
      },
      {
        onSuccess: () => {
          toast.success(
            `${playerName ?? "Player"} seated at ${table.name}`,
          );

          setPlayerId("");
          setSeatedAt(toLocalInput());
          onClose();
        },

        onError: (error) => {
          toast.error(error.message);
        },
      },
    );
  };

  return (
    <Dialog
      open={!!table}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        onOpenAutoFocus={() => {
          setPlayerId("");
          setSeatedAt(toLocalInput());
        }}
      >
        {table && (
          <form onSubmit={submit} className="space-y-5">
            <DialogHeader>
              <DialogTitle>
                Seat player at {table.name}
              </DialogTitle>

              <p className="text-sm text-muted-foreground">
                {table.game_type}
              </p>
            </DialogHeader>

            <div className="space-y-2">
              <Label>Player</Label>

              <Combobox
                value={playerId}
                onChange={setPlayerId}
                placeholder="Search player…"
                searchPlaceholder="Search player…"
                options={playerOptions}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dashboard_seated_at">
                Seated at
              </Label>

              <Input
                id="dashboard_seated_at"
                type="datetime-local"
                value={seatedAt}
                onChange={(event) =>
                  setSeatedAt(event.target.value)
                }
                className="h-12 text-base"
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
              >
                Cancel
              </Button>

              <Button
                type="submit"
                disabled={seat.isPending}
              >
                {seat.isPending
                  ? "Seating…"
                  : "Seat Player"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

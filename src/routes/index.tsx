import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import {
  ArrowRightLeft,
  LogOut,
  Pause,
  Play,
  Plus,
  Trash2,
  UserRound,
} from "lucide-react";
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

import {
  useActiveSessions,
  useDeleteSession,
  useLeaveTable,
  useMovePlayer,
  usePlayers,
  useSeatPlayer,
  useSitIn,
  useSitOut,
  useTables,
  type PokerTable,
  type Session,
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
  const [leavingSession, setLeavingSession] = useState<Session | null>(null);
  const [deletingSession, setDeletingSession] = useState<Session | null>(null);
  const [movingSession, setMovingSession] = useState<Session | null>(null);
  const [sittingOutSession, setSittingOutSession] = useState<Session | null>(null);
  const [sittingInSession, setSittingInSession] = useState<Session | null>(null);

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
                    <div className="flex min-w-0 items-center gap-3">
  {/* Small poker-table visual */}
  <div
    className="flex h-9 w-14 shrink-0 items-center justify-center rounded-[50%] border-2 border-primary/25 bg-primary/10 text-[10px] font-bold tracking-wider text-primary"
    aria-hidden="true"
  >
    ♠ ♥ ♦ ♣
  </div>

  <div className="min-w-0">
    <h2 className="truncate text-xl font-bold">
      {table.name}
    </h2>

    <p className="mt-1 truncate text-sm text-muted-foreground">
      {table.game_type}
    </p>
  </div>
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
{seatedPlayers.map((session) => {
  const openSitout = session.sitouts.find(
    (sitout) => !sitout.sat_in_at,
  );

  return (
    <div
      key={session.id}
      className="rounded-lg bg-muted/50 px-3 py-3"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 flex items-center gap-2">
          <span className={openSitout ? "h-2 w-2 shrink-0 rounded-full bg-muted-foreground" : "live-dot shrink-0"} />

          <UserRound className="h-4 w-4 shrink-0 text-muted-foreground" />

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

      {openSitout && (
        <div className="mt-2 flex items-center justify-between rounded-md border border-dashed px-2 py-1.5 text-xs text-muted-foreground">
          <span className="font-medium">Sitting out</span>
          <span className="font-mono font-semibold tabular-nums">
            {formatLiveDuration(
              now - new Date(openSitout.sat_out_at).getTime(),
            )}
          </span>
        </div>
      )}

      <div className="mt-2 flex flex-wrap justify-end gap-2">
        {openSitout ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setSittingInSession(session)}
          >
            <Play className="h-4 w-4" />
            Sit In
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setSittingOutSession(session)}
          >
            <Pause className="h-4 w-4" />
            Sit Out
          </Button>
        )}

        <Button
          size="sm"
          variant="outline"
          onClick={() => setMovingSession(session)}
        >
          <ArrowRightLeft className="h-4 w-4" />
          Move
        </Button>

        <Button
          size="sm"
          variant="outline"
          onClick={() => setLeavingSession(session)}
        >
          <LogOut className="h-4 w-4" />
          Unseat
        </Button>

        <Button
          size="icon"
          variant="ghost"
          className="h-9 w-9 text-destructive hover:text-destructive"
          title="Delete session"
          aria-label={`Delete ${session.player.full_name}'s session`}
          onClick={() => setDeletingSession(session)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
})}
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
      <MovePlayerDialog
        session={movingSession}
        onClose={() => setMovingSession(null)}
      />
      <UnseatDialog
        session={leavingSession}
        onClose={() => setLeavingSession(null)}
      />
      <SitOutDialog
        session={sittingOutSession}
        onClose={() => setSittingOutSession(null)}
      />
      <SitInDialog
        session={sittingInSession}
        onClose={() => setSittingInSession(null)}
      />

      <DeleteSessionDialog
        session={deletingSession}
        onClose={() => setDeletingSession(null)}
      />
    </>
  );
}
function MovePlayerDialog({
  session,
  onClose,
}: {
  session: Session | null;
  onClose: () => void;
}) {
  const tables = useTables();
  const movePlayer = useMovePlayer();

  const [newTableId, setNewTableId] = useState("");
  const [movedAt, setMovedAt] = useState("");
  const [error, setError] = useState<string | null>(null);

  const tableOptions = (tables.data ?? [])
    .filter((table) => table.id !== session?.table.id)
    .map((table) => ({
      value: table.id,
      label: table.name,
      hint: table.game_type,
    }));

  return (
    <Dialog
      open={!!session}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        onOpenAutoFocus={() => {
          setNewTableId("");
          setMovedAt(toLocalInput());
          setError(null);
        }}
      >
        {session && (
          <form
            className="space-y-5"
            onSubmit={(event) => {
              event.preventDefault();

              if (!newTableId) {
                setError("Choose a destination table");
                return;
              }

              if (!movedAt) {
                setError("Choose a move time");
                return;
              }

              const destinationTable = tables.data?.find(
                (table) => table.id === newTableId,
              );

              movePlayer.mutate(
                {
                  id: session.id,
                  player_id: session.player.id,
                  current_table_id: session.table.id,
                  new_table_id: newTableId,
                  seated_at: session.seated_at,
                  moved_at: fromLocalInput(movedAt),
                },
                {
                  onSuccess: () => {
                    const isSittingOut = session.sitouts.some(
                      (sitout) => !sitout.sat_in_at,
                    );

                    toast.success(
                      isSittingOut
                        ? `${session.player.full_name} moved to ${
                            destinationTable?.name ?? "new table"
                          } and remains sitting out`
                        : `${session.player.full_name} moved to ${
                            destinationTable?.name ?? "new table"
                          }`,
                    );

                    onClose();
                  },

                  onError: (err) => {
                    setError(err.message);
                  },
                },
              );
            }}
          >
            <DialogHeader>
              <DialogTitle>Move player</DialogTitle>

              <p className="text-sm text-muted-foreground">
                {session.player.full_name} · Currently at{" "}
                {session.table.name}
              </p>

              {session.sitouts.some((sitout) => !sitout.sat_in_at) && (
                <p className="text-sm font-medium text-muted-foreground">
                  This player is sitting out and will remain sitting out after the move.
                </p>
              )}
            </DialogHeader>

            <div className="space-y-2">
              <Label>Move to</Label>

              <Combobox
                value={newTableId}
                onChange={setNewTableId}
                placeholder="Choose table…"
                searchPlaceholder="Search tables…"
                options={tableOptions}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dashboard_moved_at">
                Move time
              </Label>

              <Input
                id="dashboard_moved_at"
                type="datetime-local"
                value={movedAt}
                onChange={(event) =>
                  setMovedAt(event.target.value)
                }
                className="h-12 text-base"
              />
            </div>

            {error && (
              <p className="text-sm font-medium text-destructive">
                {error}
              </p>
            )}

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
                disabled={movePlayer.isPending}
              >
                {movePlayer.isPending
                  ? "Moving…"
                  : "Move Player"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
function SitOutDialog({
  session,
  onClose,
}: {
  session: Session | null;
  onClose: () => void;
}) {
  const sitOut = useSitOut();
  const [satOutAt, setSatOutAt] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <Dialog
      open={!!session}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        onOpenAutoFocus={() => {
          setSatOutAt(toLocalInput());
          setError(null);
        }}
      >
        {session && (
          <form
            className="space-y-5"
            onSubmit={(event) => {
              event.preventDefault();

              if (!satOutAt) {
                setError("Choose a sit-out time");
                return;
              }

              sitOut.mutate(
                {
                  play_session_id: session.id,
                  seated_at: session.seated_at,
                  sat_out_at: fromLocalInput(satOutAt),
                },
                {
                  onSuccess: () => {
                    toast.success(`${session.player.full_name} is sitting out`);
                    onClose();
                  },
                  onError: (err) => setError(err.message),
                },
              );
            }}
          >
            <DialogHeader>
              <DialogTitle>Sit player out</DialogTitle>
              <p className="text-sm text-muted-foreground">
                {session.player.full_name} · {session.table.name}
              </p>
            </DialogHeader>

            <div className="space-y-2">
              <Label htmlFor="dashboard_sat_out_at">Sit-out time</Label>
              <Input
                id="dashboard_sat_out_at"
                type="datetime-local"
                value={satOutAt}
                onChange={(event) => setSatOutAt(event.target.value)}
                className="h-12 text-base"
              />
            </div>

            {error && (
              <p className="text-sm font-medium text-destructive">{error}</p>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={sitOut.isPending}>
                {sitOut.isPending ? "Saving…" : "Confirm Sit Out"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SitInDialog({
  session,
  onClose,
}: {
  session: Session | null;
  onClose: () => void;
}) {
  const sitIn = useSitIn();
  const [satInAt, setSatInAt] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <Dialog
      open={!!session}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        onOpenAutoFocus={() => {
          setSatInAt(toLocalInput());
          setError(null);
        }}
      >
        {session && (
          <form
            className="space-y-5"
            onSubmit={(event) => {
              event.preventDefault();

              if (!satInAt) {
                setError("Choose a sit-in time");
                return;
              }

              sitIn.mutate(
                {
                  play_session_id: session.id,
                  sat_in_at: fromLocalInput(satInAt),
                },
                {
                  onSuccess: () => {
                    toast.success(`${session.player.full_name} is back in`);
                    onClose();
                  },
                  onError: (err) => setError(err.message),
                },
              );
            }}
          >
            <DialogHeader>
              <DialogTitle>Sit player in</DialogTitle>
              <p className="text-sm text-muted-foreground">
                {session.player.full_name} · {session.table.name}
              </p>
            </DialogHeader>

            <div className="space-y-2">
              <Label htmlFor="dashboard_sat_in_at">Sit-in time</Label>
              <Input
                id="dashboard_sat_in_at"
                type="datetime-local"
                value={satInAt}
                onChange={(event) => setSatInAt(event.target.value)}
                className="h-12 text-base"
              />
            </div>

            {error && (
              <p className="text-sm font-medium text-destructive">{error}</p>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={sitIn.isPending}>
                {sitIn.isPending ? "Saving…" : "Confirm Sit In"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function UnseatDialog({
  session,
  onClose,
}: {
  session: Session | null;
  onClose: () => void;
}) {
  const leave = useLeaveTable();

  const [leftAt, setLeftAt] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <Dialog
      open={!!session}
      onOpenChange={(open) => {
        if (!open) onClose();
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
            className="space-y-5"
            onSubmit={(event) => {
              event.preventDefault();

              if (!leftAt) {
                setError("Choose an unseat time");
                return;
              }

              const iso = fromLocalInput(leftAt);

              leave.mutate(
                {
                  id: session.id,
                  seated_at: session.seated_at,
                  left_at: iso,
                },
                {
                  onSuccess: () => {
                    toast.success(
                      `${session.player.full_name} unseated from ${session.table.name}`,
                    );

                    onClose();
                  },

                  onError: (err) => {
                    setError(err.message);
                  },
                },
              );
            }}
          >
            <DialogHeader>
              <DialogTitle>Unseat player</DialogTitle>

              <p className="text-sm text-muted-foreground">
                {session.player.full_name} · {session.table.name}
              </p>
            </DialogHeader>

            <div className="space-y-2">
              <Label htmlFor="dashboard_left_at">
                Unseat time
              </Label>

              <Input
                id="dashboard_left_at"
                type="datetime-local"
                value={leftAt}
                onChange={(event) =>
                  setLeftAt(event.target.value)
                }
                className="h-12 text-base"
              />
            </div>

            {error && (
              <p className="text-sm font-medium text-destructive">
                {error}
              </p>
            )}

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
                disabled={leave.isPending}
              >
                {leave.isPending
                  ? "Saving…"
                  : "Confirm Unseat"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DeleteSessionDialog({
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
              ? `This will permanently delete ${session.player.full_name}'s current session at ${session.table.name}. Use this only if the seating was created by mistake.`
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

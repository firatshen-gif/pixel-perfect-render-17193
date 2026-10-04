import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent, type ReactNode } from "react";
import {
  ArrowRightLeft,
  EllipsisVertical,
  GripVertical,
  LogOut,
  Pause,
  Play,
  Plus,
  Search,
  Trash2,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
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
  localDateTimeEdited,
  localDateTimeNow,
  localDateTimeToIso,
  sessionMs,
  useNow,
} from "@/lib/time";

import { Combobox } from "@/components/Combobox";
import { Empty, Loading } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  const players = usePlayers();
  const dragMovePlayer = useMovePlayer();

  // Update the visible session timers every second.
  const now = useNow(1000);

  const dragSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  );

  const [seatingTable, setSeatingTable] = useState<PokerTable | null>(null);
  const [seatingSeatNumber, setSeatingSeatNumber] = useState<number | null>(null);
  const [leavingSession, setLeavingSession] = useState<Session | null>(null);
  const [deletingSession, setDeletingSession] = useState<Session | null>(null);
  const [movingSession, setMovingSession] = useState<Session | null>(null);
  const [sittingOutSession, setSittingOutSession] = useState<Session | null>(null);
  const [sittingInSession, setSittingInSession] = useState<Session | null>(null);
  const [draggedSession, setDraggedSession] = useState<Session | null>(null);
  const [dashboardView, setDashboardView] = useState<"compact" | "detailed">("compact");
  const [playerSearch, setPlayerSearch] = useState("");

  const normalizedSearch = playerSearch.trim().toLowerCase();

  const activeTableCount = new Set(
    (active.data ?? []).map((session) => session.table.id),
  ).size;
  const activePlayerCount = new Set(
    (active.data ?? []).map((session) => session.player.id),
  ).size;
  const sittingOutCount = new Set(
    (active.data ?? [])
      .filter((session) =>
        session.sitouts.some((sitout) => !sitout.sat_in_at),
      )
      .map((session) => session.player.id),
  ).size;

  const handleDragStart = (event: DragStartEvent) => {
    const sessionId = event.active.data.current?.sessionId as string | undefined;
    const session = (active.data ?? []).find((item) => item.id === sessionId) ?? null;
    setDraggedSession(session);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const session = draggedSession;
    setDraggedSession(null);

    if (!session || !event.over) return;

    const target = event.over.data.current;
    if (target?.kind !== "seat") return;

    const newTableId = String(target.tableId);
    const newSeatNumber = Number(target.seatNumber);

    if (
      newTableId === session.table.id &&
      newSeatNumber === session.seat_number
    ) {
      return;
    }

    const destinationTable = tables.data?.find(
      (table) => table.id === newTableId,
    );
    const isSittingOut = session.sitouts.some(
      (sitout) => !sitout.sat_in_at,
    );

    dragMovePlayer.mutate(
      {
        id: session.id,
        player_id: session.player.id,
        current_table_id: session.table.id,
        current_seat_number: session.seat_number,
        new_table_id: newTableId,
        new_seat_number: newSeatNumber,
        seated_at: session.seated_at,
        moved_at: new Date().toISOString(),
      },
      {
        onSuccess: () => {
          if (newTableId === session.table.id) {
            toast.success(
              `${session.player.full_name} moved to seat #${newSeatNumber}`,
            );
            return;
          }

          toast.success(
            isSittingOut
              ? `${session.player.full_name} moved to ${
                  destinationTable?.name ?? "new table"
                } · Seat #${newSeatNumber} and remains sitting out`
              : `${session.player.full_name} moved to ${
                  destinationTable?.name ?? "new table"
                } · Seat #${newSeatNumber}`,
          );
        },
        onError: (error) => {
          toast.error(error.message);
        },
      },
    );
  };

  if (tables.isLoading || active.isLoading || players.isLoading) {
    return <Loading />;
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-2.5">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={playerSearch}
            onChange={(event) => setPlayerSearch(event.target.value)}
            placeholder="Search player…"
            className="h-10 pl-9"
          />
        </div>

        <div
          className="flex h-8 shrink-0 items-center divide-x overflow-hidden rounded-lg border bg-muted/20"
          aria-label="Tournament totals"
        >
          <div className="flex items-baseline gap-1 px-2">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Tables
            </span>
            <span className="text-sm font-bold tabular-nums">
              {tables.data?.length ?? 0}
            </span>
          </div>
          <div className="flex items-baseline gap-1 px-2">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Active tbl
            </span>
            <span className="text-sm font-bold tabular-nums text-success">
              {activeTableCount}
            </span>
          </div>
          <div className="flex items-baseline gap-1 px-2">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Players
            </span>
            <span className="text-sm font-bold tabular-nums">
              {players.data?.length ?? 0}
            </span>
          </div>
          <div className="flex items-baseline gap-1 px-2">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Active pl
            </span>
            <span className="text-sm font-bold tabular-nums text-success">
              {activePlayerCount}
            </span>
          </div>
          <div className="flex items-baseline gap-1 px-2">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Sit out
            </span>
            <span className="text-sm font-bold tabular-nums text-amber-600 dark:text-amber-300">
              {sittingOutCount}
            </span>
          </div>
        </div>

        <div
          className="inline-flex rounded-lg border bg-muted/40 p-1"
          aria-label="Dashboard view"
        >
          <Button
            type="button"
            size="sm"
            variant={dashboardView === "compact" ? "default" : "ghost"}
            className="h-8"
            onClick={() => setDashboardView("compact")}
          >
            Compact
          </Button>
          <Button
            type="button"
            size="sm"
            variant={dashboardView === "detailed" ? "default" : "ghost"}
            className="h-8"
            onClick={() => setDashboardView("detailed")}
          >
            Detailed
          </Button>
        </div>
      </div>

      {!tables.data?.length ? (
        <Empty>No tables have been created yet.</Empty>
      ) : (
        <DndContext
          sensors={dragSensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setDraggedSession(null)}
        >
          <div
            className={
              dashboardView === "compact"
                ? "grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
                : "grid gap-4 md:grid-cols-2 xl:grid-cols-3"
            }
          >
          {tables.data.map((table) => {
            const seatedPlayers = (active.data ?? []).filter(
              (session) => session.table.id === table.id,
            );
            const sittingOutCount = seatedPlayers.filter((session) =>
              session.sitouts.some((sitout) => !sitout.sat_in_at),
            ).length;
            const sittingInCount = seatedPlayers.length - sittingOutCount;
            const unassignedPlayers = seatedPlayers.filter(
              (session) => session.seat_number == null,
            );
            const tableMatchesSearch =
              !normalizedSearch ||
              seatedPlayers.some((session) =>
                session.player.full_name
                  .toLowerCase()
                  .includes(normalizedSearch),
              );

            return (
              <div
                key={table.id}
                className={`flex flex-col rounded-xl border bg-card shadow-sm transition-opacity ${
                  normalizedSearch && !tableMatchesSearch
                    ? "opacity-35"
                    : ""
                } ${
                  normalizedSearch && tableMatchesSearch
                    ? "ring-1 ring-primary/30"
                    : ""
                }`}
              >
                {/* Table header */}
                <div className="border-b px-4 py-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-baseline gap-2">
                      <h2 className="truncate text-base font-bold">
                        {table.name}
                      </h2>

                      <span
                        className="shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      >
                        ·
                      </span>

                      <span className="truncate text-sm text-muted-foreground">
                        {table.game_type}
                      </span>
                    </div>

                    <TooltipProvider delayDuration={250}>
                      <div
                        className="flex shrink-0 items-center gap-1.5"
                        aria-label={`${seatedPlayers.length} seated, ${sittingInCount} sitting in, ${sittingOutCount} sitting out`}
                      >
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span
                              className="flex h-7 min-w-7 items-center justify-center rounded-full bg-muted px-2 text-xs font-bold text-muted-foreground"
                              tabIndex={0}
                            >
                              {seatedPlayers.length}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="bottom">
                            All seated players
                          </TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span
                              className="flex h-7 min-w-7 items-center justify-center rounded-full bg-emerald-500/20 px-2 text-xs font-bold text-emerald-700 dark:text-emerald-300"
                              tabIndex={0}
                            >
                              {sittingInCount}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="bottom">
                            Players sitting in
                          </TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span
                              className="flex h-7 min-w-7 items-center justify-center rounded-full bg-amber-400/25 px-2 text-xs font-bold text-amber-700 dark:text-amber-300"
                              tabIndex={0}
                            >
                              {sittingOutCount}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="bottom">
                            Players sitting out
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </TooltipProvider>
                  </div>
                </div>

                {/* Seats 1-12 */}
                <div className={dashboardView === "compact" ? "flex-1 p-1.5" : "flex-1 p-2"}>
                  <div
                    className={
                      dashboardView === "compact"
                        ? "grid grid-flow-col grid-cols-2 grid-rows-6 gap-px overflow-hidden rounded-lg border bg-border"
                        : "divide-y overflow-hidden rounded-lg border"
                    }
                  >
                    {Array.from({ length: 12 }, (_, index) => index + 1).map(
                      (seatNumber) => {
                        const session = seatedPlayers.find(
                          (item) => item.seat_number === seatNumber,
                        );

                        if (session) {
                          const nameMatches =
                            !normalizedSearch ||
                            session.player.full_name
                              .toLowerCase()
                              .includes(normalizedSearch);

                          return (
                            <SeatDropTarget
                              key={seatNumber}
                              tableId={table.id}
                              seatNumber={seatNumber}
                              disabled
                            >
                              <DraggablePlayerRow
                                session={session}
                                seatNumber={seatNumber}
                                now={now}
                                compact={dashboardView === "compact"}
                                dimmed={!!normalizedSearch && !nameMatches}
                                highlighted={!!normalizedSearch && nameMatches}
                                dragDisabled={dragMovePlayer.isPending}
                                onSitOut={() => setSittingOutSession(session)}
                                onSitIn={() => setSittingInSession(session)}
                                onMove={() => setMovingSession(session)}
                                onUnseat={() => setLeavingSession(session)}
                                onDelete={() => setDeletingSession(session)}
                              />
                            </SeatDropTarget>
                          );
                        }

                        return (
                          <SeatDropTarget
                            key={seatNumber}
                            tableId={table.id}
                            seatNumber={seatNumber}
                          >
                            <button
                              type="button"
                              className={`flex w-full items-center gap-2 bg-card text-left text-muted-foreground transition hover:bg-muted/60 hover:text-foreground ${
                                dashboardView === "compact"
                                  ? "min-h-8 px-1.5 py-1 text-xs"
                                  : "min-h-9 px-2 py-1.5 text-sm"
                              }`}
                              onClick={() => {
                                setSeatingTable(table);
                                setSeatingSeatNumber(seatNumber);
                              }}
                            >
                              <span
                                className={`shrink-0 font-bold tabular-nums ${
                                  dashboardView === "compact"
                                    ? "w-7 text-[11px]"
                                    : "w-8 text-xs"
                                }`}
                              >
                                #{seatNumber}
                              </span>
                              <span className="flex-1 truncate">Empty</span>
                              <Plus
                                className={
                                  dashboardView === "compact"
                                    ? "h-3 w-3 opacity-40"
                                    : "h-3.5 w-3.5 opacity-50"
                                }
                              />
                            </button>
                          </SeatDropTarget>
                        );
                      },
                    )}
                  </div>

                  {unassignedPlayers.length > 0 && (
                    <div className="mt-2 overflow-hidden rounded-lg border border-dashed">
                      <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Unassigned seat
                      </div>
                      <div className={dashboardView === "compact" ? "grid grid-cols-2 gap-px bg-border" : "divide-y"}>
                        {unassignedPlayers.map((session) => {
                          const nameMatches =
                            !normalizedSearch ||
                            session.player.full_name
                              .toLowerCase()
                              .includes(normalizedSearch);

                          return (
                            <DraggablePlayerRow
                              key={session.id}
                              session={session}
                              seatNumber={null}
                              now={now}
                              compact={dashboardView === "compact"}
                              dimmed={!!normalizedSearch && !nameMatches}
                              highlighted={!!normalizedSearch && nameMatches}
                              dragDisabled={dragMovePlayer.isPending}
                              onSitOut={() => setSittingOutSession(session)}
                              onSitIn={() => setSittingInSession(session)}
                              onMove={() => setMovingSession(session)}
                              onUnseat={() => setLeavingSession(session)}
                              onDelete={() => setDeletingSession(session)}
                            />
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

              </div>
            );
          })}
          </div>

          <DragOverlay>
            {draggedSession ? (
              <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 shadow-lg">
                <GripVertical className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-bold text-muted-foreground">
                  {draggedSession.seat_number
                    ? `#${draggedSession.seat_number}`
                    : "—"}
                </span>
                <span className="text-sm font-semibold">
                  {draggedSession.player.full_name}
                </span>
                <span className="text-xs text-muted-foreground">
                  {draggedSession.table.name}
                </span>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      <SeatAtTableDialog
        table={seatingTable}
        initialSeatNumber={seatingSeatNumber}
        onClose={() => {
          setSeatingTable(null);
          setSeatingSeatNumber(null);
        }}
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
function SeatDropTarget({
  tableId,
  seatNumber,
  disabled = false,
  children,
}: {
  tableId: string;
  seatNumber: number;
  disabled?: boolean;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `seat:${tableId}:${seatNumber}`,
    data: {
      kind: "seat",
      tableId,
      seatNumber,
    },
    disabled,
  });

  return (
    <div
      ref={setNodeRef}
      className={
        isOver && !disabled
          ? "bg-primary/10 ring-2 ring-inset ring-primary/40"
          : undefined
      }
    >
      {children}
    </div>
  );
}

function DraggablePlayerRow({
  session,
  seatNumber,
  now,
  compact = false,
  dimmed = false,
  highlighted = false,
  dragDisabled,
  onSitOut,
  onSitIn,
  onMove,
  onUnseat,
  onDelete,
}: {
  session: Session;
  seatNumber: number | null;
  now: number;
  compact?: boolean;
  dimmed?: boolean;
  highlighted?: boolean;
  dragDisabled: boolean;
  onSitOut: () => void;
  onSitIn: () => void;
  onMove: () => void;
  onUnseat: () => void;
  onDelete: () => void;
}) {
  const openSitout = session.sitouts.find(
    (sitout) => !sitout.sat_in_at,
  );

  const {
    attributes,
    listeners,
    setNodeRef,
    isDragging,
  } = useDraggable({
    id: `session:${session.id}`,
    data: {
      kind: "player",
      sessionId: session.id,
    },
    disabled: dragDisabled,
  });

  return (
    <div
      ref={setNodeRef}
      className={`flex items-center gap-1.5 transition-all ${
        compact ? "min-h-8 px-1.5 py-1" : "min-h-9 px-2 py-1.5"
      } ${openSitout ? "bg-amber-400/10" : "bg-emerald-500/8"} ${
        isDragging || dimmed ? "opacity-35" : ""
      } ${highlighted ? "ring-1 ring-inset ring-primary/50" : ""}`}
    >
      <span
        className={`shrink-0 font-bold tabular-nums text-muted-foreground ${
          compact ? "w-7 text-[11px]" : "w-8 text-xs"
        }`}
      >
        {seatNumber ? `#${seatNumber}` : "—"}
      </span>

      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className={`flex shrink-0 touch-none cursor-grab items-center justify-center rounded text-muted-foreground hover:bg-muted active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-40 ${
                compact ? "h-6 w-5" : "h-7 w-6"
              }`}
              disabled={dragDisabled}
              aria-label={`Drag ${session.player.full_name} to another seat`}
              {...attributes}
              {...listeners}
            >
              <GripVertical className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">
            Drag to another empty seat
          </TooltipContent>
        </Tooltip>

        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          {openSitout ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full bg-amber-400 ring-1 ring-amber-500/40"
                  tabIndex={0}
                  aria-label={`Sitting out for ${formatLiveDuration(
                    now - new Date(openSitout.sat_out_at).getTime(),
                  )}`}
                />
              </TooltipTrigger>
              <TooltipContent side="top">
                Sitting out for{" "}
                {formatLiveDuration(
                  now - new Date(openSitout.sat_out_at).getTime(),
                )}
              </TooltipContent>
            </Tooltip>
          ) : (
            <span className="live-dot shrink-0" />
          )}

          {!compact && (
            <UserRound className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          )}

          <span className={`truncate font-semibold ${compact ? "text-xs" : "text-sm"}`}>
            {session.player.full_name}
          </span>
        </div>

        <span
          className={`shrink-0 font-mono font-bold tabular-nums text-success ${
            compact ? "text-[9px] tracking-tight" : "text-xs"
          }`}
          title="Session duration"
        >
          {formatLiveDuration(
            sessionMs(session.seated_at, null, now),
          )}
        </span>

        {compact && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex h-6 w-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label={`Actions for ${session.player.full_name}`}
              >
                <EllipsisVertical className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onSelect={openSitout ? onSitIn : onSitOut}>
                {openSitout ? (
                  <Play className="h-4 w-4" />
                ) : (
                  <Pause className="h-4 w-4" />
                )}
                {openSitout ? "Sit In" : "Sit Out"}
              </DropdownMenuItem>

              <DropdownMenuItem onSelect={onMove}>
                <ArrowRightLeft className="h-4 w-4" />
                Move / Change seat
              </DropdownMenuItem>

              <DropdownMenuItem onSelect={onUnseat}>
                <LogOut className="h-4 w-4" />
                Unseat
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem
                onSelect={onDelete}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
                Delete session
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {!compact && (
        <div className="flex shrink-0 items-center gap-1">
          {openSitout ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="outline"
                  className="h-7 w-7"
                  aria-label={`Sit ${session.player.full_name} in`}
                  onClick={onSitIn}
                >
                  <Play className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Sit In</TooltipContent>
            </Tooltip>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="outline"
                  className="h-7 w-7"
                  aria-label={`Sit ${session.player.full_name} out`}
                  onClick={onSitOut}
                >
                  <Pause className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Sit Out</TooltipContent>
            </Tooltip>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="outline"
                className="h-7 w-7"
                aria-label={`Move ${session.player.full_name}`}
                onClick={onMove}
              >
                <ArrowRightLeft className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              Move / Change seat
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="outline"
                className="h-7 w-7"
                aria-label={`Unseat ${session.player.full_name}`}
                onClick={onUnseat}
              >
                <LogOut className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Unseat</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-destructive hover:text-destructive"
                aria-label={`Delete ${session.player.full_name}'s session`}
                onClick={onDelete}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Delete session</TooltipContent>
          </Tooltip>
        </div>
        )}
      </TooltipProvider>
    </div>
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
  const active = useActiveSessions();
  const movePlayer = useMovePlayer();

  const [newTableId, setNewTableId] = useState("");
  const [newSeatNumber, setNewSeatNumber] = useState("");
  const [movedAt, setMovedAt] = useState(() => localDateTimeNow());
  const [error, setError] = useState<string | null>(null);

  const tableOptions = (tables.data ?? []).map((table) => ({
    value: table.id,
    label: table.name,
    hint:
      table.id === session?.table.id
        ? `${table.game_type} · Current table`
        : table.game_type,
  }));

  const occupiedSeats = new Set(
    (active.data ?? [])
      .filter(
        (item) =>
          item.table.id === newTableId &&
          item.id !== session?.id &&
          item.seat_number != null,
      )
      .map((item) => item.seat_number as number),
  );

  const isSameTable = !!session && newTableId === session.table.id;

  return (
    <Dialog
      open={!!session}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        onOpenAutoFocus={() => {
          setNewTableId(session?.table.id ?? "");
          setNewSeatNumber("");
          setMovedAt(localDateTimeNow());
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

              if (!newSeatNumber) {
                setError("Choose a seat");
                return;
              }

              if (!isSameTable && !movedAt.value) {
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
                  current_seat_number: session.seat_number,
                  new_table_id: newTableId,
                  new_seat_number: Number(newSeatNumber),
                  seated_at: session.seated_at,
                  moved_at: localDateTimeToIso(movedAt),
                },
                {
                  onSuccess: () => {
                    const isSittingOut = session.sitouts.some(
                      (sitout) => !sitout.sat_in_at,
                    );

                    if (isSameTable) {
                      toast.success(
                        `${session.player.full_name} moved to seat #${newSeatNumber}`,
                      );
                    } else {
                      toast.success(
                        isSittingOut
                          ? `${session.player.full_name} moved to ${
                              destinationTable?.name ?? "new table"
                            } · Seat #${newSeatNumber} and remains sitting out`
                          : `${session.player.full_name} moved to ${
                              destinationTable?.name ?? "new table"
                            } · Seat #${newSeatNumber}`,
                      );
                    }

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
                {session.player.full_name} · {session.table.name}
                {session.seat_number ? ` · Seat #${session.seat_number}` : ""}
              </p>

              {session.sitouts.some((sitout) => !sitout.sat_in_at) && (
                <p className="text-sm font-medium text-muted-foreground">
                  If moved to another table, this player will remain sitting out.
                </p>
              )}
            </DialogHeader>

            <div className="space-y-2">
              <Label>Destination table</Label>

              <Combobox
                value={newTableId}
                onChange={(value) => {
                  setNewTableId(value);
                  setNewSeatNumber("");
                  setError(null);
                }}
                placeholder="Choose table…"
                searchPlaceholder="Search tables…"
                options={tableOptions}
              />
            </div>

            <div className="space-y-2">
              <Label>Destination seat</Label>

              <Select
                value={newSeatNumber}
                disabled={!newTableId}
                onValueChange={(value) => {
                  setNewSeatNumber(value);
                  setError(null);
                }}
              >
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="Choose seat…" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, index) => index + 1).map(
                    (seatNumber) => (
                      <SelectItem
                        key={seatNumber}
                        value={String(seatNumber)}
                        disabled={occupiedSeats.has(seatNumber)}
                      >
                        Seat #{seatNumber}
                        {session.seat_number === seatNumber && isSameTable
                          ? " · Current"
                          : occupiedSeats.has(seatNumber)
                            ? " · Occupied"
                            : ""}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>

            {!isSameTable && (
              <div className="space-y-2">
                <Label htmlFor="dashboard_moved_at">
                  Move time
                </Label>

                <Input
                  id="dashboard_moved_at"
                  type="datetime-local"
                  value={movedAt.value}
                  onChange={(event) =>
                    setMovedAt(localDateTimeEdited(event.target.value))
                  }
                  className="h-12 text-base"
                />
              </div>
            )}

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
                  : isSameTable
                    ? "Change Seat"
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
  const [satOutAt, setSatOutAt] = useState(() => localDateTimeNow());
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
          setSatOutAt(localDateTimeNow());
          setError(null);
        }}
      >
        {session && (
          <form
            className="space-y-5"
            onSubmit={(event) => {
              event.preventDefault();

              if (!satOutAt.value) {
                setError("Choose a sit-out time");
                return;
              }

              sitOut.mutate(
                {
                  play_session_id: session.id,
                  seated_at: session.seated_at,
                  sat_out_at: localDateTimeToIso(satOutAt),
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
                value={satOutAt.value}
                onChange={(event) =>
                  setSatOutAt(localDateTimeEdited(event.target.value))
                }
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
  const [satInAt, setSatInAt] = useState(() => localDateTimeNow());
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
          setSatInAt(localDateTimeNow());
          setError(null);
        }}
      >
        {session && (
          <form
            className="space-y-5"
            onSubmit={(event) => {
              event.preventDefault();

              if (!satInAt.value) {
                setError("Choose a sit-in time");
                return;
              }

              sitIn.mutate(
                {
                  play_session_id: session.id,
                  sat_in_at: localDateTimeToIso(satInAt),
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
                value={satInAt.value}
                onChange={(event) =>
                  setSatInAt(localDateTimeEdited(event.target.value))
                }
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

  const [leftAt, setLeftAt] = useState(() => localDateTimeNow());
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
          setLeftAt(localDateTimeNow());
          setError(null);
        }}
      >
        {session && (
          <form
            className="space-y-5"
            onSubmit={(event) => {
              event.preventDefault();

              if (!leftAt.value) {
                setError("Choose an unseat time");
                return;
              }

              const iso = localDateTimeToIso(leftAt);

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
                value={leftAt.value}
                onChange={(event) =>
                  setLeftAt(localDateTimeEdited(event.target.value))
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
  initialSeatNumber,
  onClose,
}: {
  table: PokerTable | null;
  initialSeatNumber: number | null;
  onClose: () => void;
}) {
  const players = usePlayers();
  const active = useActiveSessions();
  const seat = useSeatPlayer();

  const [playerId, setPlayerId] = useState("");
  const [seatedAt, setSeatedAt] = useState(() => localDateTimeNow());

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

    if (!table || initialSeatNumber == null) return;

    if (!playerId) {
      toast.error("Choose a player");
      return;
    }

    if (!seatedAt.value) {
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
        seat_number: initialSeatNumber,
        seated_at: localDateTimeToIso(seatedAt),
      },
      {
        onSuccess: () => {
          toast.success(
            `${playerName ?? "Player"} seated at ${table.name} · Seat #${initialSeatNumber}`,
          );

          setPlayerId("");
          setSeatedAt(localDateTimeNow());
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
      open={!!table && initialSeatNumber != null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        onOpenAutoFocus={() => {
          setPlayerId("");
          setSeatedAt(localDateTimeNow());
        }}
      >
        {table && initialSeatNumber != null && (
          <form onSubmit={submit} className="space-y-5">
            <DialogHeader>
              <DialogTitle>
                Seat player at {table.name}
              </DialogTitle>

              <p className="text-sm text-muted-foreground">
                {table.game_type} · Seat #{initialSeatNumber}
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
              <Label htmlFor="dashboard_seat_number">Seat</Label>
              <Input
                id="dashboard_seat_number"
                value={`Seat #${initialSeatNumber}`}
                disabled
                className="h-12 text-base"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dashboard_seated_at">
                Seated at
              </Label>

              <Input
                id="dashboard_seated_at"
                type="datetime-local"
                value={seatedAt.value}
                onChange={(event) =>
                  setSeatedAt(localDateTimeEdited(event.target.value))
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

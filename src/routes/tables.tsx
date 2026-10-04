import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { GripVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { z } from "zod";
import {
  useActiveSessions,
  useDeleteTable,
  useGameTypes,
  useReorderTables,
  useSaveTable,
  useTables,
  type PokerTable,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Empty, Loading, PageHeader } from "@/components/ui-bits";

export const Route = createFileRoute("/tables")({
  head: () => ({
    meta: [
      { title: "Tables — Tournament Floor" },
      { name: "description", content: "Manage poker tables and their game types." },
      { property: "og:title", content: "Tables — Tournament Floor" },
      { property: "og:description", content: "Manage poker tables and their game types." },
    ],
  }),
  component: TablesPage,
});

const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  game_type_id: z.string().uuid("Game type is required"),
});

function TablesPage() {
  const tables = useTables();
  const active = useActiveSessions();
  const del = useDeleteTable();
  const reorder = useReorderTables();
  const [editing, setEditing] = useState<Partial<PokerTable> | null>(null);
  const [orderedTables, setOrderedTables] = useState<PokerTable[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  );

  useEffect(() => {
    setOrderedTables(tables.data ?? []);
  }, [tables.data]);

  const seatedCount = (id: string) =>
    active.data?.filter((s) => s.table.id === id).length ?? 0;

  const handleDragEnd = (event: DragEndEvent) => {
    const activeId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : null;

    if (!overId || activeId === overId) return;

    const fromIndex = orderedTables.findIndex((table) => table.id === activeId);
    const toIndex = orderedTables.findIndex((table) => table.id === overId);

    if (fromIndex < 0 || toIndex < 0) return;

    const previous = orderedTables;
    const next = [...orderedTables];
    const [moved] = next.splice(fromIndex, 1);

    if (!moved) return;

    next.splice(toIndex, 0, moved);
    setOrderedTables(next);

    reorder.mutate(
      next.map((table) => table.id),
      {
        onSuccess: () => toast.success("Table order saved"),
        onError: (error) => {
          setOrderedTables(previous);
          toast.error(error.message);
        },
      },
    );
  };

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
        <>
          <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
            <GripVertical className="h-4 w-4" />
            Drag tables to set their order on the Dashboard.
          </div>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {orderedTables.map((table) => (
                <ReorderableTableCard
                  key={table.id}
                  table={table}
                  seatedCount={seatedCount(table.id)}
                  dragDisabled={reorder.isPending}
                  onEdit={() => setEditing(table)}
                  onDelete={() =>
                    del.mutate(table.id, {
                      onSuccess: () => toast.success("Table deleted"),
                      onError: (error) => toast.error(error.message),
                    })
                  }
                />
              ))}
            </div>
          </DndContext>
        </>
      )}

      <TableDialog value={editing} onClose={() => setEditing(null)} />
    </>
  );
}

function ReorderableTableCard({
  table,
  seatedCount,
  dragDisabled,
  onEdit,
  onDelete,
}: {
  table: PokerTable;
  seatedCount: number;
  dragDisabled: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef: setDraggableRef,
    isDragging,
  } = useDraggable({
    id: table.id,
    disabled: dragDisabled,
  });

  const {
    setNodeRef: setDroppableRef,
    isOver,
  } = useDroppable({
    id: table.id,
    disabled: dragDisabled,
  });

  const setNodeRef = (node: HTMLDivElement | null) => {
    setDraggableRef(node);
    setDroppableRef(node);
  };

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col rounded-xl border bg-card p-5 shadow-sm transition ${
        isDragging ? "opacity-40" : ""
      } ${isOver && !isDragging ? "ring-2 ring-primary/30" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <button
            type="button"
            className="mt-0.5 flex h-8 w-7 shrink-0 touch-none cursor-grab items-center justify-center rounded text-muted-foreground hover:bg-muted active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-40"
            disabled={dragDisabled}
            aria-label={`Reorder ${table.name}`}
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
          </button>

          <div className="min-w-0">
            <h3 className="truncate text-xl font-bold">{table.name}</h3>
            <p className="truncate text-muted-foreground">{table.game_type}</p>
          </div>
        </div>

        <span
          className={
            seatedCount > 0
              ? "inline-flex shrink-0 items-center gap-2 rounded-full bg-success/15 px-3 py-1 text-sm font-semibold text-success"
              : "shrink-0 rounded-full bg-muted px-3 py-1 text-sm text-muted-foreground"
          }
        >
          {seatedCount > 0 && <span className="live-dot" />}
          {seatedCount} seated
        </span>
      </div>

      <div className="mt-5 flex gap-2">
        <Button
          variant="outline"
          className="flex-1"
          onClick={onEdit}
        >
          <Pencil /> Edit
        </Button>

        <ConfirmDialog
          title={`Delete ${table.name}?`}
          description="This permanently removes the table. Tables with play history can't be deleted."
          onConfirm={onDelete}
          trigger={
            <Button
              variant="outline"
              size="icon"
              aria-label="Delete table"
            >
              <Trash2 className="text-destructive" />
            </Button>
          }
        />
      </div>
    </div>
  );
}

function TableDialog({
  value,
  onClose,
}: {
  value: Partial<PokerTable> | null;
  onClose: () => void;
}) {
  const save = useSaveTable();
  const gameTypes = useGameTypes();
  const [gameTypeId, setGameTypeId] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!value) return;

    const defaultGameType = gameTypes.data?.find((g) => g.is_default);
    const fallbackGameType = defaultGameType ?? gameTypes.data?.[0];

    setGameTypeId(
      value.game_type_id ??
        fallbackGameType?.id ??
        "",
    );
    setError(null);
  }, [value, gameTypes.data]);

  return (
    <Dialog open={!!value} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        {value && (
          <form
            key={value.id ?? "new"}
            onSubmit={(event) => {
              event.preventDefault();

              const fd = new FormData(event.currentTarget);
              const parsed = schema.safeParse({
                name: fd.get("name"),
                game_type_id: gameTypeId,
              });

              if (!parsed.success) {
                setError(parsed.error.issues[0]?.message ?? "Invalid");
                return;
              }

              setError(null);

              save.mutate(
                {
                  ...(value.id ? { id: value.id } : {}),
                  ...parsed.data,
                },
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
              <Input
                id="name"
                name="name"
                defaultValue={value.name}
                className="h-12"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label>Game type</Label>

              {gameTypes.isLoading ? (
                <div className="text-sm text-muted-foreground">
                  Loading game types…
                </div>
              ) : !gameTypes.data?.length ? (
                <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                  Add a game type before creating tables.
                </div>
              ) : (
                <Select value={gameTypeId} onValueChange={setGameTypeId}>
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="Select game type" />
                  </SelectTrigger>
                  <SelectContent>
                    {gameTypes.data.map((gameType) => (
                      <SelectItem key={gameType.id} value={gameType.id}>
                        {gameType.name}
                        {gameType.is_default ? " · Default" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {error && (
              <p className="text-sm font-medium text-destructive">{error}</p>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                size="lg"
                disabled={save.isPending || !gameTypes.data?.length}
              >
                {save.isPending ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

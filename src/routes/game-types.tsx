import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Pencil, Plus, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import {
  useDeleteGameType,
  useGameTypes,
  useSaveGameType,
  useSetDefaultGameType,
  type GameType,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Empty, Loading, PageHeader } from "@/components/ui-bits";

export const Route = createFileRoute("/game-types")({
  head: () => ({
    meta: [
      { title: "Game Types — Tournament Floor" },
      {
        name: "description",
        content: "Manage poker game types and choose the default.",
      },
      { property: "og:title", content: "Game Types — Tournament Floor" },
      {
        property: "og:description",
        content: "Manage poker game types and choose the default.",
      },
    ],
  }),
  component: GameTypesPage,
});

const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
});

function GameTypesPage() {
  const gameTypes = useGameTypes();
  const setDefault = useSetDefaultGameType();
  const del = useDeleteGameType();
  const [editing, setEditing] = useState<Partial<GameType> | null>(null);

  return (
    <>
      <PageHeader
        title="Game Types"
        subtitle="Manage available games and the default table game"
        action={
          <Button size="lg" onClick={() => setEditing({})}>
            <Plus /> Add game type
          </Button>
        }
      />

      {gameTypes.isLoading ? (
        <Loading />
      ) : !gameTypes.data?.length ? (
        <Empty>No game types yet. Add your first game type.</Empty>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Game type</th>
                <th className="px-4 py-3">Default</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>

            <tbody>
              {gameTypes.data.map((gameType) => (
                <tr key={gameType.id} className="border-t">
                  <td className="px-4 py-3 text-base font-semibold">
                    {gameType.name}
                  </td>

                  <td className="px-4 py-3">
                    {gameType.is_default ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                        <Star className="h-3.5 w-3.5 fill-current" />
                        Default
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={setDefault.isPending}
                        onClick={() =>
                          setDefault.mutate(gameType.id, {
                            onSuccess: () =>
                              toast.success(
                                `${gameType.name} is now the default game type`,
                              ),
                            onError: (error) =>
                              toast.error(error.message),
                          })
                        }
                      >
                        <Star className="h-4 w-4" />
                        Set default
                      </Button>
                    )}
                  </td>

                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        aria-label={`Edit ${gameType.name}`}
                        onClick={() => setEditing(gameType)}
                      >
                        <Pencil />
                      </Button>

                      <ConfirmDialog
                        title={`Delete ${gameType.name}?`}
                        description="This permanently removes the game type. Game types used by tables can't be deleted."
                        onConfirm={() =>
                          del.mutate(gameType, {
                            onSuccess: () =>
                              toast.success("Game type deleted"),
                            onError: (error) =>
                              toast.error(error.message),
                          })
                        }
                        trigger={
                          <Button
                            variant="outline"
                            size="icon"
                            aria-label={`Delete ${gameType.name}`}
                          >
                            <Trash2 className="text-destructive" />
                          </Button>
                        }
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <GameTypeDialog
        value={editing}
        onClose={() => setEditing(null)}
      />
    </>
  );
}

function GameTypeDialog({
  value,
  onClose,
}: {
  value: Partial<GameType> | null;
  onClose: () => void;
}) {
  const save = useSaveGameType();
  const [isDefault, setIsDefault] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!value) return;

    setIsDefault(value.is_default ?? false);
    setError(null);
  }, [value]);

  return (
    <Dialog open={!!value} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        {value && (
          <form
            key={value.id ?? "new"}
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();

              const parsed = schema.safeParse({
                name: new FormData(event.currentTarget).get("name"),
              });

              if (!parsed.success) {
                setError(parsed.error.issues[0]?.message ?? "Invalid");
                return;
              }

              setError(null);

              save.mutate(
                {
                  id: value.id,
                  name: parsed.data.name,
                  is_default: isDefault,
                  was_default: value.is_default ?? false,
                },
                {
                  onSuccess: () => {
                    toast.success(
                      value.id ? "Game type updated" : "Game type added",
                    );
                    onClose();
                  },
                  onError: (e) => setError(e.message),
                },
              );
            }}
          >
            <DialogHeader>
              <DialogTitle>
                {value.id ? "Edit game type" : "Add game type"}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-2">
              <Label htmlFor="game_type_name">Name</Label>
              <Input
                id="game_type_name"
                name="name"
                defaultValue={value.name}
                placeholder="Texas Hold'em"
                className="h-12"
                autoFocus
              />
            </div>

            <div className="flex items-start gap-3 rounded-lg border p-3">
              <Checkbox
                id="is_default"
                checked={isDefault}
                disabled={value.is_default === true}
                onCheckedChange={(checked) =>
                  setIsDefault(checked === true)
                }
              />

              <div className="space-y-1">
                <Label
                  htmlFor="is_default"
                  className="cursor-pointer"
                >
                  Default game type
                </Label>
                <p className="text-xs text-muted-foreground">
                  {value.is_default
                    ? "To change the default, set another game type as default first."
                    : "New tables will select this game type automatically."}
                </p>
              </div>
            </div>

            {error && (
              <p className="text-sm font-medium text-destructive">
                {error}
              </p>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>

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

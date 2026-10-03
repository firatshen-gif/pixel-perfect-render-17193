import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTournament } from "@/lib/tournament";

export * from "@/lib/api-tournaments";

export type PokerTable = { id: string; name: string; game_type: string; created_at: string; tournament_id: string };
export type Player = { id: string; full_name: string; created_at: string; tournament_id: string };
export type Session = {
  id: string;
  seated_at: string;
  left_at: string | null;
  player: { id: string; full_name: string };
  table: { id: string; name: string; game_type: string };
  tournament: { id: string; name: string; timezone: string };
};

const SESSION_SELECT =
  "id, seated_at, left_at, player:players!inner(id, full_name), table:poker_tables!inner(id, name, game_type), tournament:tournaments!inner(id, name, timezone)";

function check<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

function useTid() {
  return useCurrentTournament().current?.id ?? null;
}

function requireTid(tid: string | null): string {
  if (!tid) throw new Error("Select a tournament first.");
  return tid;
}

// ---------- Scoped to the current tournament ----------
export function useTables() {
  const tid = useTid();
  return useQuery({
    queryKey: ["tables", tid],
    enabled: !!tid,
    queryFn: async () =>
      check(
        await supabase.from("poker_tables").select("*").eq("tournament_id", requireTid(tid)).order("name"),
      ) as PokerTable[],
  });
}

export function usePlayers() {
  const tid = useTid();
  return useQuery({
    queryKey: ["players", tid],
    enabled: !!tid,
    queryFn: async () =>
      check(
        await supabase.from("players").select("*").eq("tournament_id", requireTid(tid)).order("full_name"),
      ) as Player[],
  });
}

export function useActiveSessions() {
  const tid = useTid();
  return useQuery({
    queryKey: ["sessions", "active", tid],
    enabled: !!tid,
    queryFn: async () =>
      check(
        await supabase
          .from("play_sessions")
          .select(SESSION_SELECT)
          .eq("tournament_id", requireTid(tid))
          .is("left_at", null)
          .order("seated_at", { ascending: false }),
      ) as unknown as Session[],
    refetchInterval: 30000,
  });
}

// ---------- Cross-tournament (Reports) ----------
export function useAllTables() {
  return useQuery({
    queryKey: ["tables", "all"],
    queryFn: async () => check(await supabase.from("poker_tables").select("*").order("name")) as PokerTable[],
  });
}

export function useAllPlayers() {
  return useQuery({
    queryKey: ["players", "all"],
    queryFn: async () => check(await supabase.from("players").select("*").order("full_name")) as Player[],
  });
}

export function useCompletedSessions(tournamentId: string) {
  return useQuery({
    queryKey: ["sessions", "completed", tournamentId],
    queryFn: async () => {
      let q = supabase.from("play_sessions").select(SESSION_SELECT).not("left_at", "is", null);
      if (tournamentId) q = q.eq("tournament_id", tournamentId);
      return check(await q.order("seated_at", { ascending: false })) as unknown as Session[];
    },
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries();
}

// ---------- Tables ----------
export function useSaveTable() {
  const inv = useInvalidate();
  const tid = useTid();
  return useMutation({
    mutationFn: async (t: { id?: string | undefined; name: string; game_type: string }) => {
      const payload = { name: t.name.trim(), game_type: t.game_type.trim() };
      if (t.id)
        check(await supabase.from("poker_tables").update(payload).eq("id", t.id).eq("tournament_id", requireTid(tid)));
      else check(await supabase.from("poker_tables").insert({ ...payload, tournament_id: requireTid(tid) }));
    },
    onSuccess: inv,
  });
}

export function useDeleteTable() {
  const inv = useInvalidate();
  const tid = useTid();
  return useMutation({
    mutationFn: async (id: string) => {
      const { count } = await supabase
        .from("play_sessions")
        .select("id", { count: "exact", head: true })
        .eq("table_id", id);
      if (count && count > 0)
        throw new Error(
          `This table has ${count} play session${count === 1 ? "" : "s"} on record and can't be deleted, to keep the history intact.`,
        );
      check(await supabase.from("poker_tables").delete().eq("id", id).eq("tournament_id", requireTid(tid)));
    },
    onSuccess: inv,
  });
}

// ---------- Players ----------
export function useSavePlayer() {
  const inv = useInvalidate();
  const tid = useTid();
  return useMutation({
    mutationFn: async (p: { id?: string | undefined; full_name: string }) => {
      const payload = { full_name: p.full_name.trim() };
      if (p.id)
        check(await supabase.from("players").update(payload).eq("id", p.id).eq("tournament_id", requireTid(tid)));
      else check(await supabase.from("players").insert({ ...payload, tournament_id: requireTid(tid) }));
    },
    onSuccess: inv,
  });
}

export function useDeletePlayer() {
  const inv = useInvalidate();
  const tid = useTid();
  return useMutation({
    mutationFn: async (id: string) => {
      const { count } = await supabase
        .from("play_sessions")
        .select("id", { count: "exact", head: true })
        .eq("player_id", id);
      if (count && count > 0)
        throw new Error(
          `This player has ${count} play session${count === 1 ? "" : "s"} on record and can't be deleted, to keep the history intact.`,
        );
      check(await supabase.from("players").delete().eq("id", id).eq("tournament_id", requireTid(tid)));
    },
    onSuccess: inv,
  });
}

// ---------- Sessions ----------
export function useSeatPlayer() {
  const inv = useInvalidate();
  const tid = useTid();
  return useMutation({
    mutationFn: async (s: { player_id: string; table_id: string; seated_at: string }) => {
      const tournament_id = requireTid(tid);
      const existing = check(
        await supabase
          .from("play_sessions")
          .select("id, table:poker_tables(name)")
          .eq("player_id", s.player_id)
          .eq("tournament_id", tournament_id)
          .is("left_at", null)
          .maybeSingle(),
      ) as { table: { name: string } | null } | null;
      if (existing)
        throw new Error(`This player is already seated at ${existing.table?.name ?? "a table"}.`);
      const res = await supabase.from("play_sessions").insert({ ...s, tournament_id });
      if (res.error) {
        if (res.error.code === "23505") throw new Error("This player is already seated.");
        throw new Error(res.error.message);
      }
    },
    onSuccess: inv,
  });
}

export function useLeaveTable() {
  const inv = useInvalidate();
  const tid = useTid();
  return useMutation({
    mutationFn: async (s: { id: string; seated_at: string; left_at: string }) => {
      if (new Date(s.left_at) < new Date(s.seated_at))
        throw new Error("Left time can't be earlier than seated time.");
      check(
        await supabase
          .from("play_sessions")
          .update({ left_at: s.left_at })
          .eq("id", s.id)
          .eq("tournament_id", requireTid(tid)),
      );
    },
    onSuccess: inv,
  });
}

/** Deletes a session. Reports may delete across tournaments, so scoping is by session id. */
export function useDeleteSession() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      check(await supabase.from("play_sessions").delete().eq("id", id));
    },
    onSuccess: inv,
  });
}

export function useMovePlayer() {
  const inv = useInvalidate();
  const tid = useTid();

  return useMutation({
    mutationFn: async (s: {
      id: string;
      player_id: string;
      current_table_id: string;
      new_table_id: string;
      seated_at: string;
      moved_at: string;
    }) => {
      const tournament_id = requireTid(tid);

      if (s.new_table_id === s.current_table_id) {
        throw new Error("Choose a different table.");
      }

      if (new Date(s.moved_at) < new Date(s.seated_at)) {
        throw new Error("Move time can't be earlier than seated time.");
      }

      // Destination must belong to the same tournament.
      const dest = check(
        await supabase.from("poker_tables").select("tournament_id").eq("id", s.new_table_id).maybeSingle(),
      ) as { tournament_id: string } | null;
      if (!dest || dest.tournament_id !== tournament_id) {
        throw new Error("The destination table belongs to a different tournament.");
      }

      // 1. Close the player's current session.
      const closeResult = await supabase
        .from("play_sessions")
        .update({ left_at: s.moved_at })
        .eq("id", s.id)
        .eq("tournament_id", tournament_id)
        .is("left_at", null);

      if (closeResult.error) {
        throw new Error(closeResult.error.message);
      }

      // 2. Start a new session at the destination table using exactly the same timestamp.
      const insertResult = await supabase.from("play_sessions").insert({
        player_id: s.player_id,
        table_id: s.new_table_id,
        seated_at: s.moved_at,
        tournament_id,
      });

      // If creating the new session fails, restore the old session.
      if (insertResult.error) {
        const rollbackResult = await supabase.from("play_sessions").update({ left_at: null }).eq("id", s.id);

        if (rollbackResult.error) {
          throw new Error(
            `Move failed and the original session could not be restored: ${insertResult.error.message}`,
          );
        }

        throw new Error(insertResult.error.message);
      }
    },

    onSuccess: inv,
  });
}

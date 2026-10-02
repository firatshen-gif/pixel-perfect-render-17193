import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type PokerTable = { id: string; name: string; game_type: string; created_at: string };
export type Player = { id: string; full_name: string; created_at: string };
export type Session = {
  id: string;
  seated_at: string;
  left_at: string | null;
  player: { id: string; full_name: string };
  table: { id: string; name: string; game_type: string };
};

const SESSION_SELECT =
  "id, seated_at, left_at, player:players!inner(id, full_name), table:poker_tables!inner(id, name, game_type)";

function check<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

export function useTables() {
  return useQuery({
    queryKey: ["tables"],
    queryFn: async () =>
      check(await supabase.from("poker_tables").select("*").order("name")) as PokerTable[],
  });
}

export function usePlayers() {
  return useQuery({
    queryKey: ["players"],
    queryFn: async () =>
      check(await supabase.from("players").select("*").order("full_name")) as Player[],
  });
}

export function useActiveSessions() {
  return useQuery({
    queryKey: ["sessions", "active"],
    queryFn: async () =>
      check(
        await supabase
          .from("play_sessions")
          .select(SESSION_SELECT)
          .is("left_at", null)
          .order("seated_at", { ascending: false }),
      ) as unknown as Session[],
    refetchInterval: 30000,
  });
}

export function useCompletedSessions() {
  return useQuery({
    queryKey: ["sessions", "completed"],
    queryFn: async () =>
      check(
        await supabase
          .from("play_sessions")
          .select(SESSION_SELECT)
          .not("left_at", "is", null)
          .order("seated_at", { ascending: false }),
      ) as unknown as Session[],
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries();
}

// ---------- Tables ----------
export function useSaveTable() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (t: { id?: string; name: string; game_type: string }) => {
      const payload = { name: t.name.trim(), game_type: t.game_type.trim() };
      if (t.id) check(await supabase.from("poker_tables").update(payload).eq("id", t.id));
      else check(await supabase.from("poker_tables").insert(payload));
    },
    onSuccess: inv,
  });
}

export function useDeleteTable() {
  const inv = useInvalidate();
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
      check(await supabase.from("poker_tables").delete().eq("id", id));
    },
    onSuccess: inv,
  });
}

// ---------- Players ----------
export function useSavePlayer() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (p: { id?: string; full_name: string }) => {
      const payload = { full_name: p.full_name.trim() };
      if (p.id) check(await supabase.from("players").update(payload).eq("id", p.id));
      else check(await supabase.from("players").insert(payload));
    },
    onSuccess: inv,
  });
}

export function useDeletePlayer() {
  const inv = useInvalidate();
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
      check(await supabase.from("players").delete().eq("id", id));
    },
    onSuccess: inv,
  });
}

// ---------- Sessions ----------
export function useSeatPlayer() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (s: { player_id: string; table_id: string; seated_at: string }) => {
      const existing = check(
        await supabase
          .from("play_sessions")
          .select("id, table:poker_tables(name)")
          .eq("player_id", s.player_id)
          .is("left_at", null)
          .maybeSingle(),
      ) as { table: { name: string } | null } | null;
      if (existing)
        throw new Error(`This player is already seated at ${existing.table?.name ?? "a table"}.`);
      const res = await supabase.from("play_sessions").insert(s);
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
  return useMutation({
    mutationFn: async (s: { id: string; seated_at: string; left_at: string }) => {
      if (new Date(s.left_at) < new Date(s.seated_at))
        throw new Error("Left time can't be earlier than seated time.");
      check(await supabase.from("play_sessions").update({ left_at: s.left_at }).eq("id", s.id));
    },
    onSuccess: inv,
  });
}

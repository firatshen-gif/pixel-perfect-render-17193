import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type PokerTable = { id: string; name: string; game_type: string; created_at: string };
export type Player = { id: string; full_name: string; created_at: string };
export type SessionSitout = {
  id: string;
  sat_out_at: string;
  sat_in_at: string | null;
};

export type Session = {
  id: string;
  seated_at: string;
  left_at: string | null;
  player: { id: string; full_name: string };
  table: { id: string; name: string; game_type: string };
  sitouts: SessionSitout[];
};

const SESSION_SELECT =
  "id, seated_at, left_at, player:players!inner(id, full_name), table:poker_tables!inner(id, name, game_type), sitouts:session_sitouts(id, sat_out_at, sat_in_at)";

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
    mutationFn: async (t: { id?: string | undefined; name: string; game_type: string }) => {
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
    mutationFn: async (p: { id?: string | undefined; full_name: string }) => {
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
      if (new Date(s.left_at) < new Date(s.seated_at)) {
        throw new Error("Left time can't be earlier than seated time.");
      }

      const openSitout = check(
        await supabase
          .from("session_sitouts")
          .select("id, sat_out_at")
          .eq("play_session_id", s.id)
          .is("sat_in_at", null)
          .maybeSingle(),
      ) as { id: string; sat_out_at: string } | null;

      if (openSitout && new Date(s.left_at) < new Date(openSitout.sat_out_at)) {
        throw new Error("Unseat time can't be earlier than the current sit-out time.");
      }

      if (openSitout) {
        check(
          await supabase
            .from("session_sitouts")
            .update({ sat_in_at: s.left_at })
            .eq("id", openSitout.id),
        );
      }

      const closeSession = await supabase
        .from("play_sessions")
        .update({ left_at: s.left_at })
        .eq("id", s.id)
        .is("left_at", null);

      if (closeSession.error) {
        if (openSitout) {
          await supabase
            .from("session_sitouts")
            .update({ sat_in_at: null })
            .eq("id", openSitout.id);
        }

        throw new Error(closeSession.error.message);
      }
    },
    onSuccess: inv,
  });
}

export function useSitOut() {
  const inv = useInvalidate();

  return useMutation({
    mutationFn: async (s: {
      play_session_id: string;
      seated_at: string;
      sat_out_at: string;
    }) => {
      if (new Date(s.sat_out_at) < new Date(s.seated_at)) {
        throw new Error("Sit-out time can't be earlier than seated time.");
      }

      const session = check(
        await supabase
          .from("play_sessions")
          .select("id, left_at")
          .eq("id", s.play_session_id)
          .maybeSingle(),
      ) as { id: string; left_at: string | null } | null;

      if (!session || session.left_at) {
        throw new Error("This play session is no longer active.");
      }

      const latest = check(
        await supabase
          .from("session_sitouts")
          .select("id, sat_out_at, sat_in_at")
          .eq("play_session_id", s.play_session_id)
          .order("sat_out_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ) as { id: string; sat_out_at: string; sat_in_at: string | null } | null;

      if (latest?.sat_in_at === null) {
        throw new Error("This player is already sitting out.");
      }

      if (latest?.sat_in_at && new Date(s.sat_out_at) < new Date(latest.sat_in_at)) {
        throw new Error("Sit-out time can't overlap a previous sit-out.");
      }

      const result = await supabase.from("session_sitouts").insert({
        play_session_id: s.play_session_id,
        sat_out_at: s.sat_out_at,
      });

      if (result.error) {
        if (result.error.code === "23505") {
          throw new Error("This player is already sitting out.");
        }

        throw new Error(result.error.message);
      }
    },
    onSuccess: inv,
  });
}

export function useSitIn() {
  const inv = useInvalidate();

  return useMutation({
    mutationFn: async (s: {
      play_session_id: string;
      sat_in_at: string;
    }) => {
      const session = check(
        await supabase
          .from("play_sessions")
          .select("id, left_at")
          .eq("id", s.play_session_id)
          .maybeSingle(),
      ) as { id: string; left_at: string | null } | null;

      if (!session || session.left_at) {
        throw new Error("This play session is no longer active.");
      }

      const openSitout = check(
        await supabase
          .from("session_sitouts")
          .select("id, sat_out_at")
          .eq("play_session_id", s.play_session_id)
          .is("sat_in_at", null)
          .maybeSingle(),
      ) as { id: string; sat_out_at: string } | null;

      if (!openSitout) {
        throw new Error("This player is not currently sitting out.");
      }

      if (new Date(s.sat_in_at) < new Date(openSitout.sat_out_at)) {
        throw new Error("Sit-in time can't be earlier than sit-out time.");
      }

      check(
        await supabase
          .from("session_sitouts")
          .update({ sat_in_at: s.sat_in_at })
          .eq("id", openSitout.id),
      );
    },
    onSuccess: inv,
  });
}

export function useDeleteSession() {
  const inv = useInvalidate();

  return useMutation({
    mutationFn: async (id: string) => {
      check(
        await supabase
          .from("play_sessions")
          .delete()
          .eq("id", id),
      );
    },
    onSuccess: inv,
  });
}
export function useMovePlayer() {
  const inv = useInvalidate();

  return useMutation({
    mutationFn: async (s: {
      id: string;
      player_id: string;
      current_table_id: string;
      new_table_id: string;
      seated_at: string;
      moved_at: string;
    }) => {
      if (s.new_table_id === s.current_table_id) {
        throw new Error("Choose a different table.");
      }

      if (new Date(s.moved_at) < new Date(s.seated_at)) {
        throw new Error("Move time can't be earlier than seated time.");
      }

      const openSitout = check(
        await supabase
          .from("session_sitouts")
          .select("id")
          .eq("play_session_id", s.id)
          .is("sat_in_at", null)
          .maybeSingle(),
      );

      if (openSitout) {
        throw new Error("Sit the player back in before moving them to another table.");
      }

      // 1. Close the player's current session.
      const closeResult = await supabase
        .from("play_sessions")
        .update({ left_at: s.moved_at })
        .eq("id", s.id)
        .is("left_at", null);

      if (closeResult.error) {
        throw new Error(closeResult.error.message);
      }

      // 2. Start a new session at the destination table
      // using exactly the same timestamp.
      const insertResult = await supabase
        .from("play_sessions")
        .insert({
          player_id: s.player_id,
          table_id: s.new_table_id,
          seated_at: s.moved_at,
        });

      // If creating the new session fails, restore the old
      // session so the player doesn't accidentally become unseated.
      if (insertResult.error) {
        const rollbackResult = await supabase
          .from("play_sessions")
          .update({ left_at: null })
          .eq("id", s.id);

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

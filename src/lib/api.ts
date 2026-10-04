import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type GameType = {
  id: string;
  name: string;
  is_default: boolean;
  created_at: string;
};

export type PokerTable = {
  id: string;
  name: string;
  game_type_id: string | null;
  game_type: string;
  sort_order: number;
  created_at: string;
};

export type Player = { id: string; full_name: string; created_at: string };

export type WaitlistEntry = {
  id: string;
  player_id: string;
  added_at: string;
  player: { id: string; full_name: string };
};

export type SessionSitout = {
  id: string;
  sat_out_at: string;
  sat_in_at: string | null;
};

export type Session = {
  id: string;
  seated_at: string;
  left_at: string | null;
  seat_number: number | null;
  player: { id: string; full_name: string };
  table: { id: string; name: string; game_type: string };
  sitouts: SessionSitout[];
};

type RawPokerTable = {
  id: string;
  name: string;
  game_type_id: string | null;
  sort_order: number;
  created_at: string;
  game_type_ref: { id: string; name: string; is_default?: boolean } | null;
};

type RawSession = {
  id: string;
  seated_at: string;
  left_at: string | null;
  seat_number: number | null;
  player: { id: string; full_name: string };
  table: {
    id: string;
    name: string;
    game_type_id: string | null;
    game_type_ref: { id: string; name: string } | null;
  };
  sitouts: SessionSitout[];
};

const TABLE_SELECT =
  "id, name, created_at, game_type_id, sort_order, game_type_ref:game_types!poker_tables_game_type_id_fkey(id, name, is_default)";

const SESSION_SELECT =
  "id, seated_at, left_at, seat_number, player:players!inner(id, full_name), table:poker_tables!inner(id, name, game_type_id, game_type_ref:game_types!poker_tables_game_type_id_fkey(id, name)), sitouts:session_sitouts(id, sat_out_at, sat_in_at)";

function normalizeTable(table: RawPokerTable): PokerTable {
  return {
    id: table.id,
    name: table.name,
    game_type_id: table.game_type_id,
    game_type: table.game_type_ref?.name ?? "Unknown game",
    sort_order: table.sort_order,
    created_at: table.created_at,
  };
}

function normalizeSession(session: RawSession): Session {
  return {
    id: session.id,
    seated_at: session.seated_at,
    left_at: session.left_at,
    seat_number: session.seat_number,
    player: session.player,
    table: {
      id: session.table.id,
      name: session.table.name,
      game_type: session.table.game_type_ref?.name ?? "Unknown game",
    },
    sitouts: session.sitouts ?? [],
  };
}

function check<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

export function useGameTypes() {
  return useQuery({
    queryKey: ["game-types"],
    queryFn: async () =>
      check(
        await supabase
          .from("game_types")
          .select("*")
          .order("is_default", { ascending: false })
          .order("name"),
      ) as GameType[],
  });
}

export function useTables() {
  return useQuery({
    queryKey: ["tables"],
    queryFn: async () => {
      const rows = check(
        await supabase
          .from("poker_tables")
          .select(TABLE_SELECT)
          .order("sort_order")
          .order("name"),
      ) as unknown as RawPokerTable[];

      return rows.map(normalizeTable);
    },
  });
}

export function usePlayers() {
  return useQuery({
    queryKey: ["players"],
    queryFn: async () =>
      check(await supabase.from("players").select("*").order("full_name")) as Player[],
  });
}

export function useWaitlist() {
  return useQuery({
    queryKey: ["waitlist"],
    queryFn: async () =>
      check(
        await supabase
          .from("waitlist")
          .select("id, player_id, added_at, player:players!inner(id, full_name)")
          .order("added_at", { ascending: true }),
      ) as unknown as WaitlistEntry[],
    refetchInterval: 30000,
  });
}

export function useActiveSessions() {
  return useQuery({
    queryKey: ["sessions", "active"],
    queryFn: async () =>
      (
        check(
          await supabase
            .from("play_sessions")
            .select(SESSION_SELECT)
            .is("left_at", null)
            .order("seated_at", { ascending: false }),
        ) as unknown as RawSession[]
      ).map(normalizeSession),
    refetchInterval: 30000,
  });
}

export function useCompletedSessions() {
  return useQuery({
    queryKey: ["sessions", "completed"],
    queryFn: async () =>
      (
        check(
          await supabase
            .from("play_sessions")
            .select(SESSION_SELECT)
            .not("left_at", "is", null)
            .order("seated_at", { ascending: false }),
        ) as unknown as RawSession[]
      ).map(normalizeSession),
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries();
}

// ---------- Game types ----------
async function makeGameTypeDefault(id: string) {
  const previous = check(
    await supabase
      .from("game_types")
      .select("id")
      .eq("is_default", true)
      .maybeSingle(),
  ) as { id: string } | null;

  if (previous?.id === id) return;

  if (previous) {
    check(
      await supabase
        .from("game_types")
        .update({ is_default: false })
        .eq("id", previous.id),
    );
  }

  const setDefault = await supabase
    .from("game_types")
    .update({ is_default: true })
    .eq("id", id);

  if (setDefault.error) {
    if (previous) {
      await supabase
        .from("game_types")
        .update({ is_default: true })
        .eq("id", previous.id);
    }

    throw new Error(setDefault.error.message);
  }
}

export function useSaveGameType() {
  const inv = useInvalidate();

  return useMutation({
    mutationFn: async (g: {
      id?: string;
      name: string;
      is_default: boolean;
      was_default?: boolean;
    }) => {
      const name = g.name.trim();

      if (!name) throw new Error("Game type name is required.");

      if (g.id) {
        if (g.was_default && !g.is_default) {
          throw new Error("Choose another default game type before removing this default.");
        }

        check(
          await supabase
            .from("game_types")
            .update({ name })
            .eq("id", g.id),
        );

        if (g.is_default) {
          await makeGameTypeDefault(g.id);
        }

        return;
      }

      const created = check(
        await supabase
          .from("game_types")
          .insert({ name, is_default: false })
          .select("id")
          .single(),
      ) as { id: string };

      if (g.is_default) {
        await makeGameTypeDefault(created.id);
      }
    },
    onSuccess: inv,
  });
}

export function useSetDefaultGameType() {
  const inv = useInvalidate();

  return useMutation({
    mutationFn: async (id: string) => {
      await makeGameTypeDefault(id);
    },
    onSuccess: inv,
  });
}

export function useDeleteGameType() {
  const inv = useInvalidate();

  return useMutation({
    mutationFn: async (g: GameType) => {
      if (g.is_default) {
        throw new Error("Set another game type as default before deleting this one.");
      }

      const { count, error } = await supabase
        .from("poker_tables")
        .select("id", { count: "exact", head: true })
        .eq("game_type_id", g.id);

      if (error) throw new Error(error.message);

      if (count && count > 0) {
        throw new Error(
          `This game type is used by ${count} table${count === 1 ? "" : "s"} and can't be deleted.`,
        );
      }

      check(await supabase.from("game_types").delete().eq("id", g.id));
    },
    onSuccess: inv,
  });
}

// ---------- Tables ----------
export function useSaveTable() {
  const inv = useInvalidate();

  return useMutation({
    mutationFn: async (t: {
      id?: string;
      name: string;
      game_type_id: string;
    }) => {
      const gameType = check(
        await supabase
          .from("game_types")
          .select("id, name")
          .eq("id", t.game_type_id)
          .single(),
      ) as { id: string; name: string };

      // Keep the legacy text column in sync until the final cleanup migration.
      const payload = {
        name: t.name.trim(),
        game_type_id: gameType.id,
        game_type: gameType.name,
      };

      if (t.id) {
        check(
          await supabase
            .from("poker_tables")
            .update(payload)
            .eq("id", t.id),
        );
      } else {
        const lastTable = check(
          await supabase
            .from("poker_tables")
            .select("sort_order")
            .order("sort_order", { ascending: false })
            .limit(1)
            .maybeSingle(),
        ) as { sort_order: number } | null;

        check(
          await supabase.from("poker_tables").insert({
            ...payload,
            sort_order: (lastTable?.sort_order ?? 0) + 1,
          }),
        );
      }
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

export function useReorderTables() {
  const inv = useInvalidate();

  return useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const current = check(
        await supabase
          .from("poker_tables")
          .select("id, sort_order")
          .in("id", orderedIds),
      ) as { id: string; sort_order: number }[];

      const previousOrder = new Map(
        current.map((table) => [table.id, table.sort_order]),
      );

      const updates = await Promise.all(
        orderedIds.map((id, index) =>
          supabase
            .from("poker_tables")
            .update({ sort_order: index + 1 })
            .eq("id", id),
        ),
      );

      const failed = updates.find((result) => result.error);

      if (failed?.error) {
        await Promise.all(
          current.map((table) =>
            supabase
              .from("poker_tables")
              .update({ sort_order: previousOrder.get(table.id) ?? table.sort_order })
              .eq("id", table.id),
          ),
        );

        throw new Error(failed.error.message);
      }
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

// ---------- Waitlist ----------
export function useAddToWaitlist() {
  const inv = useInvalidate();

  return useMutation({
    mutationFn: async (playerId: string) => {
      const activeSession = check(
        await supabase
          .from("play_sessions")
          .select("id, table:poker_tables(name)")
          .eq("player_id", playerId)
          .is("left_at", null)
          .maybeSingle(),
      ) as { id: string; table: { name: string } | null } | null;

      if (activeSession) {
        throw new Error(
          `This player is already seated at ${activeSession.table?.name ?? "a table"}.`,
        );
      }

      const result = await supabase.from("waitlist").insert({
        player_id: playerId,
      });

      if (result.error) {
        if (result.error.code === "23505") {
          throw new Error("This player is already on the waitlist.");
        }

        throw new Error(result.error.message);
      }
    },
    onSuccess: inv,
  });
}

export function useRemoveFromWaitlist() {
  const inv = useInvalidate();

  return useMutation({
    mutationFn: async (id: string) => {
      check(await supabase.from("waitlist").delete().eq("id", id));
    },
    onSuccess: inv,
  });
}

export function useSeatFromWaitlist() {
  const inv = useInvalidate();

  return useMutation({
    mutationFn: async (s: {
      waitlist_id: string;
      player_id: string;
      table_id: string;
      seat_number: number;
      seated_at: string;
    }) => {
      if (s.seat_number < 1 || s.seat_number > 12) {
        throw new Error("Seat number must be between 1 and 12.");
      }

      const activeSession = check(
        await supabase
          .from("play_sessions")
          .select("id, table:poker_tables(name)")
          .eq("player_id", s.player_id)
          .is("left_at", null)
          .maybeSingle(),
      ) as { id: string; table: { name: string } | null } | null;

      if (activeSession) {
        throw new Error(
          `This player is already seated at ${activeSession.table?.name ?? "a table"}.`,
        );
      }

      const occupiedSeat = check(
        await supabase
          .from("play_sessions")
          .select("id")
          .eq("table_id", s.table_id)
          .eq("seat_number", s.seat_number)
          .is("left_at", null)
          .maybeSingle(),
      ) as { id: string } | null;

      if (occupiedSeat) {
        throw new Error(`Seat #${s.seat_number} is already occupied.`);
      }

      // Claim the waitlist row first. If another operator already seated or removed
      // this player, the row will be gone and no new session is created.
      const claimed = check(
        await supabase
          .from("waitlist")
          .delete()
          .eq("id", s.waitlist_id)
          .eq("player_id", s.player_id)
          .select("id, player_id, added_at")
          .maybeSingle(),
      ) as { id: string; player_id: string; added_at: string } | null;

      if (!claimed) {
        throw new Error("This player is no longer on the waitlist.");
      }

      const insertResult = await supabase.from("play_sessions").insert({
        player_id: s.player_id,
        table_id: s.table_id,
        seat_number: s.seat_number,
        seated_at: s.seated_at,
      });

      if (insertResult.error) {
        const restore = await supabase.from("waitlist").insert({
          id: claimed.id,
          player_id: claimed.player_id,
          added_at: claimed.added_at,
        });

        if (restore.error) {
          throw new Error(
            `Seating failed and the waitlist entry could not be restored: ${insertResult.error.message}`,
          );
        }

        if (insertResult.error.code === "23505") {
          throw new Error("This player or seat is no longer available.");
        }

        throw new Error(insertResult.error.message);
      }
    },
    onSuccess: inv,
  });
}

// ---------- Sessions ----------
export function useSeatPlayer() {
  const inv = useInvalidate();

  return useMutation({
    mutationFn: async (s: {
      player_id: string;
      table_id: string;
      seat_number: number;
      seated_at: string;
    }) => {
      if (s.seat_number < 1 || s.seat_number > 12) {
        throw new Error("Seat number must be between 1 and 12.");
      }

      const existing = check(
        await supabase
          .from("play_sessions")
          .select("id, table:poker_tables(name)")
          .eq("player_id", s.player_id)
          .is("left_at", null)
          .maybeSingle(),
      ) as { table: { name: string } | null } | null;

      if (existing) {
        throw new Error(
          `This player is already seated at ${existing.table?.name ?? "a table"}.`,
        );
      }

      const occupiedSeat = check(
        await supabase
          .from("play_sessions")
          .select("id")
          .eq("table_id", s.table_id)
          .eq("seat_number", s.seat_number)
          .is("left_at", null)
          .maybeSingle(),
      ) as { id: string } | null;

      if (occupiedSeat) {
        throw new Error(`Seat #${s.seat_number} is already occupied.`);
      }

      const res = await supabase
        .from("play_sessions")
        .insert(s)
        .select("id")
        .single();

      if (res.error || !res.data) {
        if (res.error?.code === "23505") {
          throw new Error("This player or seat is no longer available.");
        }

        throw new Error(res.error?.message ?? "Could not seat player.");
      }

      // If the player was waiting, seating them anywhere should remove the
      // stale waitlist entry so the two states can never remain out of sync.
      const waitlistCleanup = await supabase
        .from("waitlist")
        .delete()
        .eq("player_id", s.player_id);

      if (waitlistCleanup.error) {
        await supabase
          .from("play_sessions")
          .delete()
          .eq("id", res.data.id);

        throw new Error(
          `Could not keep the waitlist in sync: ${waitlistCleanup.error.message}`,
        );
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
      current_seat_number: number | null;
      new_table_id: string;
      new_seat_number: number;
      seated_at: string;
      moved_at: string;
    }) => {
      if (s.new_seat_number < 1 || s.new_seat_number > 12) {
        throw new Error("Seat number must be between 1 and 12.");
      }

      if (
        s.new_table_id === s.current_table_id &&
        s.new_seat_number === s.current_seat_number
      ) {
        throw new Error("Choose a different seat or table.");
      }

      const occupiedSeat = check(
        await supabase
          .from("play_sessions")
          .select("id")
          .eq("table_id", s.new_table_id)
          .eq("seat_number", s.new_seat_number)
          .is("left_at", null)
          .neq("id", s.id)
          .maybeSingle(),
      ) as { id: string } | null;

      if (occupiedSeat) {
        throw new Error(`Seat #${s.new_seat_number} is already occupied.`);
      }

      // A seat change within the same table does not create a new session.
      if (s.new_table_id === s.current_table_id) {
        const changeSeat = await supabase
          .from("play_sessions")
          .update({ seat_number: s.new_seat_number })
          .eq("id", s.id)
          .is("left_at", null);

        if (changeSeat.error) {
          if (changeSeat.error.code === "23505") {
            throw new Error(`Seat #${s.new_seat_number} is already occupied.`);
          }

          throw new Error(changeSeat.error.message);
        }

        return;
      }

      if (new Date(s.moved_at) < new Date(s.seated_at)) {
        throw new Error("Move time can't be earlier than seated time.");
      }

      const openSitout = check(
        await supabase
          .from("session_sitouts")
          .select("id, sat_out_at")
          .eq("play_session_id", s.id)
          .is("sat_in_at", null)
          .maybeSingle(),
      ) as { id: string; sat_out_at: string } | null;

      if (openSitout && new Date(s.moved_at) < new Date(openSitout.sat_out_at)) {
        throw new Error("Move time can't be earlier than the current sit-out time.");
      }

      if (openSitout) {
        check(
          await supabase
            .from("session_sitouts")
            .update({ sat_in_at: s.moved_at })
            .eq("id", openSitout.id),
        );
      }

      const closeResult = await supabase
        .from("play_sessions")
        .update({ left_at: s.moved_at })
        .eq("id", s.id)
        .is("left_at", null);

      if (closeResult.error) {
        if (openSitout) {
          await supabase
            .from("session_sitouts")
            .update({ sat_in_at: null })
            .eq("id", openSitout.id);
        }

        throw new Error(closeResult.error.message);
      }

      const insertResult = await supabase
        .from("play_sessions")
        .insert({
          player_id: s.player_id,
          table_id: s.new_table_id,
          seat_number: s.new_seat_number,
          seated_at: s.moved_at,
        })
        .select("id")
        .single();

      if (insertResult.error || !insertResult.data) {
        const restoreSession = await supabase
          .from("play_sessions")
          .update({ left_at: null })
          .eq("id", s.id);

        let restoreSitoutError: string | null = null;

        if (openSitout) {
          const restoreSitout = await supabase
            .from("session_sitouts")
            .update({ sat_in_at: null })
            .eq("id", openSitout.id);

          restoreSitoutError = restoreSitout.error?.message ?? null;
        }

        if (restoreSession.error || restoreSitoutError) {
          throw new Error(
            `Move failed and the original state could not be fully restored: ${
              insertResult.error?.message ?? "Could not create destination session"
            }`,
          );
        }

        if (insertResult.error?.code === "23505") {
          throw new Error(`Seat #${s.new_seat_number} is already occupied.`);
        }

        throw new Error(
          insertResult.error?.message ?? "Could not create destination session.",
        );
      }

      if (openSitout) {
        const newSitoutResult = await supabase
          .from("session_sitouts")
          .insert({
            play_session_id: insertResult.data.id,
            sat_out_at: s.moved_at,
          });

        if (newSitoutResult.error) {
          const deleteNewSession = await supabase
            .from("play_sessions")
            .delete()
            .eq("id", insertResult.data.id);

          const restoreSession = await supabase
            .from("play_sessions")
            .update({ left_at: null })
            .eq("id", s.id);

          const restoreSitout = await supabase
            .from("session_sitouts")
            .update({ sat_in_at: null })
            .eq("id", openSitout.id);

          if (
            deleteNewSession.error ||
            restoreSession.error ||
            restoreSitout.error
          ) {
            throw new Error(
              `Move failed and the original sit-out state could not be fully restored: ${newSitoutResult.error.message}`,
            );
          }

          throw new Error(newSitoutResult.error.message);
        }
      }
    },

    onSuccess: inv,
  });
}

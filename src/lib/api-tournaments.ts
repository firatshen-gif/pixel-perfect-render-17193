import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Tournament = { id: string; name: string; location: string; timezone: string; created_at: string };

export function useTournaments() {
  return useQuery({
    queryKey: ["tournaments"],
    queryFn: async () => {
      const res = await supabase.from("tournaments").select("*").order("created_at", { ascending: false });
      if (res.error) throw new Error(res.error.message);
      return res.data as Tournament[];
    },
  });
}

export function useSaveTournament() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (t: { id?: string | undefined; name: string; location: string; timezone: string }) => {
      const payload = { name: t.name.trim(), location: t.location.trim(), timezone: t.timezone };
      const res = t.id
        ? await supabase.from("tournaments").update(payload).eq("id", t.id)
        : await supabase.from("tournaments").insert(payload);
      if (res.error) throw new Error(res.error.message);
    },
    onSuccess: () => qc.invalidateQueries(),
  });
}

export function useDeleteTournament() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const count = async (table: "players" | "poker_tables" | "play_sessions") =>
        (await supabase.from(table).select("id", { count: "exact", head: true }).eq("tournament_id", id)).count ?? 0;
      const [p, t, s] = await Promise.all([count("players"), count("poker_tables"), count("play_sessions")]);
      if (p || t || s) {
        const parts = [
          p && `${p} player${p === 1 ? "" : "s"}`,
          t && `${t} table${t === 1 ? "" : "s"}`,
          s && `${s} session${s === 1 ? "" : "s"}`,
        ].filter(Boolean);
        throw new Error(
          `This tournament still has ${parts.join(", ")}. Remove them first — tournaments with data can't be deleted.`,
        );
      }
      const res = await supabase.from("tournaments").delete().eq("id", id);
      if (res.error) throw new Error(res.error.message);
    },
    onSuccess: () => qc.invalidateQueries(),
  });
}

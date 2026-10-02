CREATE TABLE public.poker_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  game_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.play_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE RESTRICT,
  table_id uuid NOT NULL REFERENCES public.poker_tables(id) ON DELETE RESTRICT,
  seated_at timestamptz NOT NULL,
  left_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT left_after_seated CHECK (left_at IS NULL OR left_at >= seated_at)
);
CREATE UNIQUE INDEX one_active_session_per_player ON public.play_sessions(player_id) WHERE left_at IS NULL;
CREATE INDEX play_sessions_table_idx ON public.play_sessions(table_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.poker_tables, public.players, public.play_sessions TO anon, authenticated;
GRANT ALL ON public.poker_tables, public.players, public.play_sessions TO service_role;

ALTER TABLE public.poker_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.play_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "open access tables" ON public.poker_tables FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "open access players" ON public.players FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "open access sessions" ON public.play_sessions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE TABLE public.tournaments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  location text NOT NULL,
  timezone text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tournaments TO anon, authenticated;
GRANT ALL ON public.tournaments TO service_role;
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open access tournaments" ON public.tournaments FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.players ADD COLUMN tournament_id uuid REFERENCES public.tournaments(id) ON DELETE RESTRICT;
ALTER TABLE public.poker_tables ADD COLUMN tournament_id uuid REFERENCES public.tournaments(id) ON DELETE RESTRICT;
ALTER TABLE public.play_sessions ADD COLUMN tournament_id uuid REFERENCES public.tournaments(id) ON DELETE RESTRICT;
CREATE INDEX players_tournament_idx ON public.players(tournament_id);
CREATE INDEX poker_tables_tournament_idx ON public.poker_tables(tournament_id);
CREATE INDEX play_sessions_tournament_idx ON public.play_sessions(tournament_id);

CREATE OR REPLACE FUNCTION public.require_tournament_id()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.tournament_id IS NULL THEN
    RAISE EXCEPTION 'tournament_id is required';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER players_require_tournament BEFORE INSERT OR UPDATE ON public.players
  FOR EACH ROW EXECUTE FUNCTION public.require_tournament_id();
CREATE TRIGGER poker_tables_require_tournament BEFORE INSERT OR UPDATE ON public.poker_tables
  FOR EACH ROW EXECUTE FUNCTION public.require_tournament_id();

CREATE OR REPLACE FUNCTION public.check_session_tournament()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE p_t uuid; t_t uuid;
BEGIN
  SELECT tournament_id INTO p_t FROM public.players WHERE id = NEW.player_id;
  SELECT tournament_id INTO t_t FROM public.poker_tables WHERE id = NEW.table_id;
  IF NEW.tournament_id IS NULL THEN NEW.tournament_id := t_t; END IF;
  IF NEW.tournament_id IS NULL THEN RAISE EXCEPTION 'tournament_id is required'; END IF;
  IF p_t IS DISTINCT FROM NEW.tournament_id THEN
    RAISE EXCEPTION 'Player belongs to a different tournament';
  END IF;
  IF t_t IS DISTINCT FROM NEW.tournament_id THEN
    RAISE EXCEPTION 'Table belongs to a different tournament';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER play_sessions_check_tournament BEFORE INSERT OR UPDATE ON public.play_sessions
  FOR EACH ROW EXECUTE FUNCTION public.check_session_tournament();
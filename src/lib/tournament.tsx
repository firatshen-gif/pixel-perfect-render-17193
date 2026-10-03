import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Trophy } from "lucide-react";
import { useTournaments, type Tournament } from "@/lib/api-tournaments";
import { Button } from "@/components/ui/button";
import { Loading } from "@/components/ui-bits";

const STORAGE_KEY = "currentTournamentId";

type Ctx = {
  tournaments: Tournament[];
  current: Tournament | null;
  setCurrentId: (id: string) => void;
  isLoading: boolean;
};

const TournamentContext = createContext<Ctx>({
  tournaments: [],
  current: null,
  setCurrentId: () => {},
  isLoading: true,
});

export function TournamentProvider({ children }: { children: ReactNode }) {
  const q = useTournaments();
  const [storedId, setStoredId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setStoredId(localStorage.getItem(STORAGE_KEY));
    setHydrated(true);
  }, []);

  const tournaments = q.data ?? [];
  // Stored id if it still exists, else most recently created (list is newest first).
  const current = tournaments.find((t) => t.id === storedId) ?? tournaments[0] ?? null;

  const value = useMemo<Ctx>(
    () => ({
      tournaments,
      current,
      isLoading: q.isLoading || !hydrated,
      setCurrentId: (id: string) => {
        localStorage.setItem(STORAGE_KEY, id);
        setStoredId(id);
      },
    }),
    [tournaments, current, q.isLoading, hydrated],
  );

  return <TournamentContext.Provider value={value}>{children}</TournamentContext.Provider>;
}

export function useCurrentTournament() {
  return useContext(TournamentContext);
}

/** Renders children only when a tournament is selected; otherwise loading / empty state. */
export function TournamentGate({ children }: { children: (t: Tournament) => ReactNode }) {
  const { current, isLoading } = useCurrentTournament();
  if (isLoading) return <Loading />;
  if (!current)
    return (
      <div className="mx-auto max-w-md rounded-xl border border-dashed p-10 text-center">
        <Trophy className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
        <h2 className="text-xl font-bold">No tournament yet</h2>
        <p className="mt-2 text-muted-foreground">Create a tournament first to manage tables, players and seating.</p>
        <Button asChild size="lg" className="mt-5">
          <Link to="/tournaments">Go to Tournaments</Link>
        </Button>
      </div>
    );
  return <>{children(current)}</>;
}

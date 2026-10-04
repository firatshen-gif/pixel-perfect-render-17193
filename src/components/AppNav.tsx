import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  BarChart3,
  Grid3x3,
  LayoutDashboard,
  LogOut,
  Moon,
  Spade,
  Sun,
  Tags,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const items = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/tables", label: "Tables", icon: Grid3x3 },
  { to: "/game-types", label: "Game Types", icon: Tags },
  { to: "/players", label: "Players", icon: Users },
  { to: "/reports", label: "Reports", icon: BarChart3 },
] as const;

export function AppNav() {
  const [signingOut, setSigningOut] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    setDarkMode(document.documentElement.classList.contains("dark"));
  }, []);

  const toggleDarkMode = () => {
    const nextDarkMode = !darkMode;

    document.documentElement.classList.toggle("dark", nextDarkMode);
    localStorage.setItem(
      "tournament-floor-theme",
      nextDarkMode ? "dark" : "light",
    );
    setDarkMode(nextDarkMode);
  };

  const signOut = async () => {
    setSigningOut(true);
    const { error } = await supabase.auth.signOut();
    setSigningOut(false);

    if (error) {
      toast.error(error.message);
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-felt text-felt-foreground shadow-md">
      <div className="mx-auto flex max-w-[100rem] items-center gap-4 px-4 py-2">
        <Link to="/" className="flex items-center gap-2 py-2 font-extrabold tracking-tight">
          <span className="grid h-9 w-9 place-items-center rounded-md bg-accent text-accent-foreground">
            <Spade className="h-5 w-5" />
          </span>
          <span className="hidden sm:inline">Tournament Floor</span>
        </Link>
        <nav className="flex flex-1 gap-1 overflow-x-auto">
          {items.map((i) => (
            <Link
              key={i.to}
              to={i.to}
              activeOptions={{ exact: i.to === "/" }}
              className="flex shrink-0 items-center gap-2 rounded-md px-3 py-2.5 text-sm font-semibold opacity-80 transition hover:bg-sidebar-accent hover:opacity-100 data-[status=active]:bg-accent data-[status=active]:text-accent-foreground data-[status=active]:opacity-100"
            >
              <i.icon className="h-4 w-4" />
              <span>{i.label}</span>
            </Link>
          ))}
        </nav>
        <button
          type="button"
          onClick={toggleDarkMode}
          className="relative flex h-7 w-12 shrink-0 items-center rounded-full border border-white/15 bg-black/15 p-0.5 transition hover:bg-black/25"
          role="switch"
          aria-checked={darkMode}
          aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
          title={darkMode ? "Light mode" : "Dark mode"}
        >
          <span
            className={`flex h-5 w-5 items-center justify-center rounded-full bg-felt-foreground text-felt shadow-sm transition-transform ${
              darkMode ? "translate-x-5" : "translate-x-0"
            }`}
          >
            {darkMode ? (
              <Moon className="h-3 w-3" />
            ) : (
              <Sun className="h-3 w-3" />
            )}
          </span>
        </button>

        <button
          type="button"
          onClick={signOut}
          disabled={signingOut}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md opacity-80 transition hover:bg-sidebar-accent hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Sign out"
          title="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}

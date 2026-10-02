import { Link } from "@tanstack/react-router";
import { LayoutDashboard, Grid3x3, Users, Armchair, BarChart3, Spade } from "lucide-react";

const items = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/sessions", label: "Seating", icon: Armchair },
  { to: "/tables", label: "Tables", icon: Grid3x3 },
  { to: "/players", label: "Players", icon: Users },
  { to: "/reports", label: "Reports", icon: BarChart3 },
] as const;

export function AppNav() {
  return (
    <header className="sticky top-0 z-40 bg-felt text-felt-foreground shadow-md">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-2">
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
      </div>
    </header>
  );
}

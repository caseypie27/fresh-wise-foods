import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Boxes, CalendarDays, BarChart3, User, Plus } from "lucide-react";

const items = [
  { to: "/home", label: "Home", icon: Home },
  { to: "/inventory", label: "Items", icon: Boxes },
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/stats", label: "Stats", icon: BarChart3 },
  { to: "/profile", label: "You", icon: User },
] as const;

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-[440px] bg-surface/90 backdrop-blur-md border-t border-border px-2 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="grid grid-cols-5 items-end">
        {items.slice(0, 2).map((it) => (
          <NavItem key={it.to} {...it} active={pathname === it.to} />
        ))}
        <div className="flex justify-center -mt-7">
          <Link
            to="/add"
            aria-label="Add item"
            className="size-14 rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/30 ring-4 ring-background grid place-items-center transition-transform active:scale-95"
          >
            <Plus className="size-6" strokeWidth={2.5} />
          </Link>
        </div>
        {items.slice(2).map((it) => (
          <NavItem key={it.to} {...it} active={pathname === it.to} />
        ))}
      </div>
    </nav>
  );
}

function NavItem({
  to,
  label,
  icon: Icon,
  active,
}: {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
}) {
  return (
    <Link
      to={to}
      className={`flex flex-col items-center gap-1 py-2 transition-colors ${
        active ? "text-primary" : "text-muted-foreground"
      }`}
    >
      <Icon className="size-5" />
      <span className="text-[10px] font-medium tracking-tight">{label}</span>
    </Link>
  );
}

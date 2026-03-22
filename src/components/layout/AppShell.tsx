import { Outlet } from "react-router-dom";
import { NavLink } from "react-router-dom";
import { Plus, Search, Sprout } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", label: "Lookup Slots", icon: Search },
  { to: "/add-slot", label: "Add Slot", icon: Plus },
  { to: "/add-plant", label: "Add Plant", icon: Sprout },
];

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
    isActive
      ? "bg-primary text-primary-foreground"
      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
  );

export function AppShell() {
  const { signOut } = useAuth();

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="hidden border-r bg-card md:flex md:w-56 md:flex-col">
        <div className="flex h-14 items-center border-b px-4">
          <h1 className="font-semibold">Farmstand EXP</h1>
        </div>
        <nav className="flex-1 space-y-1 p-2">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={navLinkClass}>
              <Icon className="size-4" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t p-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={signOut}
            className="w-full justify-start"
          >
            Sign out
          </Button>
        </div>
      </aside>

      <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b bg-card px-4 md:hidden">
        <h1 className="font-semibold">Farmstand EXP</h1>
        <Button variant="ghost" size="sm" onClick={signOut}>
          Sign out
        </Button>
      </header>

      <main className="flex-1 overflow-auto pb-20 md:pb-0">
        <div className="container mx-auto max-w-2xl p-4">
          <Outlet />
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 flex border-t bg-card md:hidden">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                "flex flex-1 flex-col items-center gap-1 py-2 text-xs",
                isActive ? "text-primary" : "text-muted-foreground"
              )
            }
          >
            <Icon className="size-5" />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

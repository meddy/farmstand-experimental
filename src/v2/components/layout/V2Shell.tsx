import { Outlet } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

export function V2Shell() {
  const { signOut } = useAuth();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b bg-card px-4">
        <h1 className="font-semibold">Farmstand V2</h1>
        <Button variant="ghost" size="sm" onClick={signOut}>
          Sign out
        </Button>
      </header>

      <main className="flex-1 overflow-auto">
        <div className="container mx-auto max-w-2xl p-4">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

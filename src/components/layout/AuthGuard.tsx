import { type ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

interface AuthGuardProps {
  children: ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { user, status, signIn, signOut } = useAuth();

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <h1 className="text-xl font-semibold">Farmstand Experimental</h1>
            <p className="text-sm text-muted-foreground">
              Sign in with Google to access the app.
            </p>
          </CardHeader>
          <CardContent>
            <Button onClick={signIn} className="w-full">
              Sign in with Google
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === "unauthorized") {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <h1 className="text-xl font-semibold">Access Denied</h1>
            <p className="text-sm text-muted-foreground">
              Your account ({user?.email}) is not on the allowed list.
            </p>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={signOut} className="w-full">
              Sign out
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}

import { useState, useEffect, useCallback } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { signInWithGoogle, signOut as authSignOut, isUserAllowed } from "@/lib/auth";

type AuthStatus = "loading" | "authenticated" | "unauthorized" | "unauthenticated";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) {
        setStatus("unauthenticated");
        return;
      }
      isUserAllowed(u.email ?? "")
        .then((allowed) => {
          setStatus(allowed ? "authenticated" : "unauthorized");
        })
        .catch(() => {
          setStatus("unauthorized");
        });
    });
    return unsub;
  }, []);

  const signIn = useCallback(async () => {
    await signInWithGoogle();
  }, []);

  const signOut = useCallback(async () => {
    await authSignOut();
  }, []);

  return { user, status, signIn, signOut };
}

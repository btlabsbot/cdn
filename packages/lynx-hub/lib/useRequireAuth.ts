"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchMe, type AuthUser } from "./apiClient";

/**
 * Client-side auth guard: checks the session on mount and redirects to
 * /login if there isn't one. Returns the checking/user state so the page
 * can avoid flashing protected content before the check resolves.
 */
export function useRequireAuth(): { checking: boolean; user: AuthUser | null } {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetchMe()
      .then((me) => {
        if (cancelled) return;
        if (!me) {
          router.replace("/login");
          return;
        }
        setUser(me);
        setChecking(false);
      })
      .catch(() => {
        if (!cancelled) router.replace("/login");
      });

    return () => {
      cancelled = true;
    };
  }, [router]);

  return { checking, user };
}

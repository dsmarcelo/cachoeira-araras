"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ConvexProviderWithAuth, ConvexReactClient } from "convex/react";
import { getSession } from "next-auth/react";

import { env } from "@/env";

const convex = new ConvexReactClient(env.NEXT_PUBLIC_CONVEX_URL);

/**
 * Bridges the NextAuth session to Convex: tracks whether a NextAuth session
 * exists (via next-auth's standalone `getSession`, no SessionProvider
 * needed) and, once signed in, fetches a short-lived RS256 token from
 * /api/auth/convex-token for ConvexProviderWithAuth to attach and refresh
 * before expiry. See src/server/convex-auth-bridge.ts for why this
 * indirection exists instead of handing NextAuth's session token to Convex
 * directly.
 */
function useNextAuthForConvex() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    getSession()
      .then((session) => {
        if (!cancelled) {
          setIsAuthenticated(session !== null);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setIsAuthenticated(false);
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const fetchAccessToken = useCallback(async () => {
    const response = await fetch("/api/auth/convex-token", {
      cache: "no-store",
    });

    if (!response.ok) {
      setIsAuthenticated(false);
      return null;
    }

    const { token } = (await response.json()) as { token: string };
    return token;
  }, []);

  return useMemo(
    () => ({ isLoading, isAuthenticated, fetchAccessToken }),
    [isLoading, isAuthenticated, fetchAccessToken],
  );
}

export function ConvexClientProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ConvexProviderWithAuth client={convex} useAuth={useNextAuthForConvex}>
      {children}
    </ConvexProviderWithAuth>
  );
}

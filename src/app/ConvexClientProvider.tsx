"use client";

import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import { ConvexReactClient } from "convex/react";
import type { ComponentProps } from "react";

import { authClient } from "@/lib/auth-client";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// The provider's published type currently rejects Better Auth clients with
// extra plugins even though it supports them at runtime. Keep one shared
// client so username sign-in also refreshes the Convex auth state.
const convexAuthClient = authClient as unknown as ComponentProps<
  typeof ConvexBetterAuthProvider
>["authClient"];

export function ConvexClientProvider({
  children,
  initialToken,
}: {
  children: React.ReactNode;
  initialToken?: string | null;
}) {
  return (
    <ConvexBetterAuthProvider
      client={convex}
      authClient={convexAuthClient}
      initialToken={initialToken}
    >
      {children}
    </ConvexBetterAuthProvider>
  );
}

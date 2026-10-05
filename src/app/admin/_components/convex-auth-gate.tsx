"use client";

import { useConvexAuth } from "convex/react";
import type { ReactNode } from "react";

import { Skeleton } from "@/components/ui/skeleton";

/**
 * Holds admin pages back until the browser has handed the login to Convex.
 * The server layout has already verified the user, but admin pages query
 * Convex from the client on mount; without this wait a direct load or reload
 * fires those queries unauthenticated and shows "401: not signed in".
 */
export default function ConvexAuthGate({ children }: { children: ReactNode }) {
  const { isLoading } = useConvexAuth();

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-4 p-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return children;
}

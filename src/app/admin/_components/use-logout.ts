"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

import { authClient } from "@/lib/auth-client";

/** Signs the staff member out and returns them to the /admin login screen. */
export function useLogout() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function logout() {
    startTransition(async () => {
      await authClient.signOut();
      router.replace("/admin");
      router.refresh();
    });
  }

  return { logout, isPending };
}

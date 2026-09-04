"use client";

import React, { type ReactNode, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export default function AdminHeader({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleLogout() {
    startTransition(async () => {
      await authClient.signOut();
      router.replace("/admin");
      router.refresh();
    });
  }

  return (
    <header className="sticky top-0 z-50 flex h-12 w-full items-center justify-between border-b border-border bg-background px-4 md:px-6">
      {children}
      <Button
        variant="ghost"
        type="button"
        className="p-0 text-sm text-muted-foreground hover:text-foreground hover:bg-transparent"
        onClick={handleLogout}
        disabled={isPending}
      >
        {isPending ? "Saindo..." : "Sair"}
      </Button>
    </header>
  );
}

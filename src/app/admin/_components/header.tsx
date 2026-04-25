"use client";

import React, { type ReactNode, useTransition } from "react";
import { signOut } from "next-auth/react";

import { Button } from "@/components/ui/button";

export default function AdminHeader({ children }: { children: ReactNode }) {
  const [isPending, startTransition] = useTransition();

  function handleLogout() {
    startTransition(async () => {
      await signOut({ callbackUrl: "/admin" });
    });
  }

  return (
    <header className="sticky top-0 z-50 flex h-12 w-full items-center justify-between border-b bg-gray-50 px-4 md:px-6">
      {children}
      <Button
        variant="ghost"
        type="button"
        className="p-0 text-sm text-slate-400"
        onClick={handleLogout}
        disabled={isPending}
      >
        {isPending ? "Saindo..." : "Sair"}
      </Button>
    </header>
  );
}

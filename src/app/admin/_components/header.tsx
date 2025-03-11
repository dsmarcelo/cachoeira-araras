"use client";
import { logout } from "@/app/lib";
import { Button } from "@/components/ui/button";
import React, { type ReactNode } from "react";

export default function AdminHeader({ children }: { children: ReactNode }) {
  return (
    <header className="sticky top-0 z-50 flex h-12 w-full items-center justify-between border-b bg-gray-50 px-4 md:px-6">
      {children}
      <form
        action={async () => {
          await logout();
        }}
      >
        <Button
          variant={"ghost"}
          type="submit"
          className="p-0 text-sm text-slate-400"
        >
          Sair
        </Button>
      </form>
    </header>
  );
}

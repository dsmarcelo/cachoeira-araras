"use client";

import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";

import { useSidebar } from "@/components/ui/sidebar";
import { adminPageTitle } from "./admin-nav";
import { useLogout } from "./use-logout";

/** Sticky top bar: menu toggle, the current page's title and "Sair". */
export default function AdminHeader() {
  const pathname = usePathname();
  const { toggleSidebar } = useSidebar();
  const { logout, isPending } = useLogout();

  return (
    <header className="sticky top-0 z-40 flex h-16 w-full items-center gap-1 border-b border-border bg-white px-2 md:px-4">
      <button
        type="button"
        aria-label="Abrir menu"
        onClick={toggleSidebar}
        className="flex size-11 items-center justify-center rounded-lg text-foreground hover:bg-muted"
      >
        <Menu className="size-5" aria-hidden />
      </button>
      <h1 className="flex-1 truncate text-lg font-semibold tracking-tight">
        {adminPageTitle(pathname)}
      </h1>
      <button
        type="button"
        onClick={logout}
        disabled={isPending}
        className="h-11 rounded-lg px-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
      >
        {isPending ? "Saindo..." : "Sair"}
      </button>
    </header>
  );
}

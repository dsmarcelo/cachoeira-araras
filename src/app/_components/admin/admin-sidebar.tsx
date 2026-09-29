"use client";

import { ChevronRight, Droplets, LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { adminNav, type AdminRole } from "@/app/admin/_components/admin-nav";
import { useLogout } from "@/app/admin/_components/use-logout";
import { cn } from "@/lib/utils";

const itemClass =
  "flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors";

export default function DashboardSidebar({
  role,
  username,
}: {
  role: AdminRole;
  username: string;
}) {
  const pathname = usePathname();
  const { setOpenMobile, isMobile } = useSidebar();
  const { logout, isPending } = useLogout();

  function closeOnMobile() {
    if (isMobile) setOpenMobile(false);
  }

  return (
    <Sidebar className="border-r border-border">
      <SidebarHeader className="h-16 flex-row items-center gap-2.5 border-b border-border bg-white px-4">
        <span className="flex size-8 items-center justify-center rounded-lg bg-teal-700 text-white">
          <Droplets className="size-[18px]" aria-hidden />
        </span>
        <span className="flex flex-col leading-tight">
          <span className="text-[15px] font-semibold tracking-tight">Painel da equipe</span>
          <span className="text-xs text-muted-foreground">
            {role === "admin" ? "Administrador" : "Funcionário"}
          </span>
        </span>
      </SidebarHeader>

      <SidebarContent className="gap-2 bg-white p-2">
        {adminNav.map((group) => {
          const items = group.items.filter((item) => item.roles.includes(role));
          if (items.length === 0) return null;
          return (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel className="text-xs font-medium text-muted-foreground">
                {group.label}
              </SidebarGroupLabel>
              <SidebarMenu className="gap-0.5">
                {items.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <SidebarMenuItem key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        onClick={closeOnMobile}
                        className={cn(
                          itemClass,
                          active
                            ? "bg-muted font-semibold text-foreground"
                            : "text-zinc-700 hover:bg-zinc-50 hover:text-foreground",
                        )}
                      >
                        <item.icon className="size-[18px]" aria-hidden />
                        {item.name}
                      </Link>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroup>
          );
        })}
      </SidebarContent>

      <SidebarFooter className="gap-0.5 border-t border-border bg-white p-3">
        <Link
          href="/admin/conta"
          onClick={closeOnMobile}
          aria-current={pathname === "/admin/conta" ? "page" : undefined}
          className={cn(
            "flex h-[52px] items-center gap-3 rounded-lg px-3 transition-colors hover:bg-zinc-50",
            pathname === "/admin/conta" && "bg-muted",
          )}
        >
          <span className="flex size-8 items-center justify-center rounded-full border border-border bg-muted text-[13px] font-semibold uppercase">
            {username.charAt(0) || "?"}
          </span>
          <span className="flex min-w-0 flex-1 flex-col leading-tight">
            <span className="truncate text-sm font-medium">{username}</span>
            <span className="text-xs text-muted-foreground">Minha conta</span>
          </span>
          <ChevronRight className="size-4 text-zinc-400" aria-hidden />
        </Link>
        <button
          type="button"
          onClick={logout}
          disabled={isPending}
          className={cn(itemClass, "text-muted-foreground hover:bg-zinc-50 hover:text-foreground disabled:opacity-50")}
        >
          <LogOut className="size-[18px]" aria-hidden />
          {isPending ? "Saindo..." : "Sair"}
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}

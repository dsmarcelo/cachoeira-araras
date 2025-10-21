"use client";

import { Cog, Ticket } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import Image from "next/image";

// Dashboard navigation items
const sidebarItems = [
  {
    name: "Validar Voucher",
    icon: <Ticket className="h-5 w-5" />,
    href: "/admin",
  },
  {
    name: "Visão Geral",
    icon: <Ticket className="h-5 w-5" />,
    href: "/admin/dashboard/vouchers",
  },
  {
    name: "Configurações",
    icon: <Cog className="h-5 w-5" />,
    href: "/admin/dashboard/configuracoes",
  },
];

export default function DashboardSidebar() {
  const pathname = usePathname();
  const { setOpenMobile, isMobile } = useSidebar();

  const handleMenuItemClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <Sidebar>
      <SidebarHeader className="flex items-center justify-center bg-background py-4">
        <Image
          src="/logo_nome.png"
          className="brightness-75 invert"
          alt="logo"
          width={60}
          height={60}
          unoptimized
        />
      </SidebarHeader>
      <SidebarContent className="bg-background">
        <SidebarGroup>
          <SidebarMenu>
            {sidebarItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <SidebarMenuItem key={item.name}>
                  <SidebarMenuButton asChild>
                    <Link
                      href={item.href}
                      className={`flex items-center rounded-lg px-2 py-2 text-sm font-medium ${
                        isActive
                          ? "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary hover:text-sidebar-primary-foreground font-medium"
                          : "text-muted-foreground hover:bg-muted"
                      }`}
                      onClick={handleMenuItemClick}
                    >
                      {item.icon}
                      <span className="ml-3">{item.name}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

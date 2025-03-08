"use client";

import {
  DollarSign,
  GitFork,
  Home,
  PieChart,
  Ticket,
  Users,
} from "lucide-react";
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
    name: "Voucher de hoje",
    icon: <Ticket className="h-5 w-5" />,
    href: "/admin/hoje",
  },
  {
    name: "Visão Geral",
    icon: <Home className="h-5 w-5" />,
    href: "/admin/dashboard",
  },
  {
    name: "Vendas",
    icon: <DollarSign className="h-5 w-5" />,
    href: "/admin/dashboard/vendas",
  },
  {
    name: "Vouchers",
    icon: <Ticket className="h-5 w-5" />,
    href: "/admin/dashboard/vouchers",
  },
];

export default function DashboardSidebar() {
  const pathname = usePathname();
  return (
    <Sidebar>
      <SidebarHeader className="flex items-center justify-center">
        <Image
          src="/logo_nome.png"
          className="brightness-75 invert"
          alt="logo"
          width={60}
          height={60}
          unoptimized
        />
      </SidebarHeader>
      <SidebarContent>
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
                          ? "bg-muted text-muted-foreground"
                          : "text-muted-foreground hover:bg-muted"
                      }`}
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

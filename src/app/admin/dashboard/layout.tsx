"use client";

import { ReactNode } from "react";
import {
  DollarSign,
  GitFork,
  Home,
  PieChart,
  Ticket,
  Users,
  CreditCard,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";

// Dashboard navigation items
const sidebarItems = [
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
    name: "Visitantes",
    icon: <Users className="h-5 w-5" />,
    href: "/admin/dashboard/visitantes",
  },
  {
    name: "Vouchers",
    icon: <Ticket className="h-5 w-5" />,
    href: "/admin/dashboard/vouchers",
  },
  {
    name: "Métodos de Pagamento",
    icon: <CreditCard className="h-5 w-5" />,
    href: "/admin/dashboard/pagamentos",
  },
  {
    name: "Referências",
    icon: <GitFork className="h-5 w-5" />,
    href: "/admin/dashboard/referencias",
  },
  {
    name: "Relatórios",
    icon: <PieChart className="h-5 w-5" />,
    href: "/admin/dashboard/relatorios",
  },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <SidebarProvider>
      <div className="flex h-screen">
        <Sidebar className="w-64">
          <div className="flex items-center p-4">
            <Ticket className="mr-2 h-6 w-6" />
            <span className="text-xl font-bold">Cachoeira Araras</span>
          </div>
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
        <div className="flex-1 overflow-auto">{children}</div>
      </div>
    </SidebarProvider>
  );
}

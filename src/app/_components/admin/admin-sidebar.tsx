"use client";

import {
  CircleUserRound,
  Cog,
  CreditCard,
  FlaskConical,
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
  useSidebar,
} from "@/components/ui/sidebar";
import Image from "next/image";
import { cn } from "@/lib/utils";

type UserRole = "admin" | "employee";

const adminSidebarItems = [
  {
    name: "Validar Voucher",
    icon: <Ticket className="h-5 w-5" />,
    href: "/admin",
  },
  {
    name: "Visão Geral",
    icon: <Ticket className="h-5 w-5" />,
    href: "/admin/tabela",
  },
  {
    name: "Pagamentos",
    icon: <CreditCard className="h-5 w-5" />,
    href: "/admin/dashboard/pagamentos",
  },
  {
    name: "Configurações",
    icon: <Cog className="h-5 w-5" />,
    href: "/admin/dashboard/configuracoes",
  },
  {
    name: "Usuarios",
    icon: <Users className="h-5 w-5" />,
    href: "/admin/dashboard/usuarios",
  },
  {
    name: "Compra Teste",
    icon: <FlaskConical className="h-5 w-5" />,
    href: "/admin/compra-teste",
  },
  {
    name: "Minha conta",
    icon: <CircleUserRound className="h-5 w-5" />,
    href: "/admin/conta",
  },
];

const employeeSidebarItems = [
  {
    name: "Validar Voucher",
    icon: <Ticket className="h-5 w-5" />,
    href: "/admin",
  },
  {
    name: "Compra Teste",
    icon: <FlaskConical className="h-5 w-5" />,
    href: "/admin/compra-teste",
  },
  {
    name: "Minha conta",
    icon: <CircleUserRound className="h-5 w-5" />,
    href: "/admin/conta",
  },
];

export default function DashboardSidebar({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const { setOpenMobile, isMobile } = useSidebar();
  const sidebarItems =
    role === "admin" ? adminSidebarItems : employeeSidebarItems;

  const handleMenuItemClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <Sidebar className="border-r border-sidebar-border">
      <SidebarHeader className="flex items-center justify-center bg-sidebar border-b border-sidebar-border py-4">
        <Image
          src="/logo_nome.png"
          alt="logo"
          width={60}
          height={60}
          unoptimized
          className="h-auto w-[60px]"
        />
      </SidebarHeader>
      <SidebarContent className="bg-sidebar">
        <SidebarGroup>
          <SidebarMenu>
            {sidebarItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <SidebarMenuItem key={item.name}>
                  <SidebarMenuButton asChild isActive={isActive}>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center rounded-lg px-2 py-2 text-sm font-medium transition-colors",
                        isActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
                          : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
                      )}
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

import {
  CreditCard,
  FlaskConical,
  ScanLine,
  SlidersHorizontal,
  Ticket,
  Users,
  type LucideIcon,
} from "lucide-react";

export type AdminRole = "admin" | "employee";

type NavItem = {
  name: string;
  href: string;
  icon: LucideIcon;
  /** Roles that see this entry; the pages enforce the same rule server-side. */
  roles: ReadonlyArray<AdminRole>;
};

/** Sidebar groups, in display order. The header title comes from here too. */
export const adminNav: ReadonlyArray<{ label: string; items: ReadonlyArray<NavItem> }> = [
  {
    label: "Portaria",
    items: [
      { name: "Validar voucher", href: "/admin", icon: ScanLine, roles: ["admin", "employee"] },
      { name: "Compra teste", href: "/admin/compra-teste", icon: FlaskConical, roles: ["admin", "employee"] },
    ],
  },
  {
    label: "Gestão",
    items: [
      { name: "Vouchers", href: "/admin/tabela", icon: Ticket, roles: ["admin"] },
      { name: "Pagamentos", href: "/admin/dashboard/pagamentos", icon: CreditCard, roles: ["admin"] },
      { name: "Usuários", href: "/admin/dashboard/usuarios", icon: Users, roles: ["admin"] },
      { name: "Configurações", href: "/admin/dashboard/configuracoes", icon: SlidersHorizontal, roles: ["admin"] },
    ],
  },
];

const extraTitles: Record<string, string> = {
  "/admin/conta": "Minha conta",
  "/admin/dashboard/vendas": "Vendas",
  "/admin/dashboard/referencias": "Referências",
};

export function adminPageTitle(pathname: string): string {
  for (const group of adminNav) {
    const match = group.items.find((item) => item.href === pathname);
    if (match) return match.name;
  }
  return extraTitles[pathname] ?? "Painel";
}

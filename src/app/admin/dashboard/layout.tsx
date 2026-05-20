import type { ReactNode } from "react";

import { requireAdmin } from "@/app/lib";

export default async function AdminDashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await requireAdmin();

  if (!user) {
    return null;
  }

  return children;
}

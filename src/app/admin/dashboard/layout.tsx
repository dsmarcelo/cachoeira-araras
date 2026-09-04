import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { getCurrentAuthUser } from "@/lib/auth-server";

export default async function AdminDashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await getCurrentAuthUser();

  if (user?.role !== "admin") {
    redirect("/admin");
  }

  return children;
}

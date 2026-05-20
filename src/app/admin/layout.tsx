import React from "react";
import AdminHeader from "./_components/header";
import { getCurrentUserRole } from "../lib";
import PasswordLoginForm from "../_components/passwordLoginForm";
import AdminFooter from "./_components/footer";
import DashboardSidebar from "../_components/admin/admin-sidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const role = await getCurrentUserRole();

  if (!role) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center px-4">
        <PasswordLoginForm />
      </div>
    );
  }
  return (
    <SidebarProvider>
      <DashboardSidebar role={role} />
      <div className="flex min-h-screen w-full flex-col">
        <AdminHeader>
          <SidebarTrigger className="" />
        </AdminHeader>
        <main className="flex-grow">{children}</main>
        <AdminFooter />
      </div>
    </SidebarProvider>
  );
}

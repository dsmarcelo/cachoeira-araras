import React from "react";
import AdminHeader from "./_components/header";
import PasswordLoginForm from "../_components/passwordLoginForm";
import AdminFooter from "./_components/footer";
import DashboardSidebar from "../_components/admin/admin-sidebar";
import AdminThemeEffect from "./_components/admin-theme-effect";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { getCurrentAuthUser } from "@/lib/auth-server";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentAuthUser();

  if (!user) {
    return (
      <div className="dark flex min-h-screen w-full flex-col items-center justify-center bg-background text-foreground px-4">
        <AdminThemeEffect />
        <PasswordLoginForm />
      </div>
    );
  }
  return (
    <div className="dark min-h-screen w-full bg-background text-foreground">
      <AdminThemeEffect />
      <SidebarProvider className="min-h-screen">
        <DashboardSidebar role={user.role} />
        <div className="flex min-h-screen w-full flex-col bg-background text-foreground">
          <AdminHeader>
            <SidebarTrigger className="" />
          </AdminHeader>
          <main className="flex-grow">{children}</main>
          <AdminFooter />
        </div>
      </SidebarProvider>
    </div>
  );
}

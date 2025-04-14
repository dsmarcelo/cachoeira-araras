import React from "react";
import AdminHeader from "./_components/header";
import { isLoggedIn } from "../lib";
import PasswordLoginForm from "../_components/passwordLoginForm";
import AdminFooter from "./_components/footer";
import DashboardSidebar from "../_components/admin/admin-sidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const isAdmin = await isLoggedIn();
  if (!isAdmin) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center px-4">
        <PasswordLoginForm />
      </div>
    );
  }
  return (
    <>
      <SidebarProvider>
        <DashboardSidebar />
        <div className="flex min-h-screen w-full flex-col">
          <AdminHeader>
            <SidebarTrigger className="" />
          </AdminHeader>
          <main className="flex-grow">{children}</main>
          <AdminFooter />
        </div>
      </SidebarProvider>
    </>
  );
}

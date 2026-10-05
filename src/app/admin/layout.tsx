import React from "react";
import { Geist, Geist_Mono } from "next/font/google";

import AdminHeader from "./_components/header";
import AdminFooter from "./_components/footer";
import AdminFontScope from "./_components/admin-font-scope";
import ConvexAuthGate from "./_components/convex-auth-gate";
import PasswordLoginForm from "../_components/passwordLoginForm";
import DashboardSidebar from "../_components/admin/admin-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { getCurrentAuthUser } from "@/lib/auth-server";
import { cn } from "@/lib/utils";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

// Applied to <body> as well (AdminFontScope) so portaled drawers and dialogs
// render in the admin typeface too.
const fontClasses = cn(geist.variable, geistMono.variable, "admin-scope");

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentAuthUser();

  return (
    <div className={cn(fontClasses, "min-h-screen w-full bg-zinc-50 text-foreground")}>
      <AdminFontScope className={fontClasses} />
      {!user ? (
        <div className="flex min-h-screen flex-col items-center justify-center px-4">
          <PasswordLoginForm />
        </div>
      ) : (
        <SidebarProvider className="min-h-screen">
          <DashboardSidebar role={user.role} username={user.username} />
          <div className="flex min-h-screen w-full min-w-0 flex-col">
            <AdminHeader />
            <main className="flex-grow">
              <ConvexAuthGate>{children}</ConvexAuthGate>
            </main>
            <AdminFooter />
          </div>
        </SidebarProvider>
      )}
    </div>
  );
}

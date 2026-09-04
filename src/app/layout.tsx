import "@/styles/globals.css";
import { TRPCReactProvider } from "@/trpc/react";
import { ConvexClientProvider } from "@/app/ConvexClientProvider";
import { Toaster } from "@/components/ui/toaster";
import { Inter } from "next/font/google";
import { type Metadata } from "next";
import { Analytics } from "@vercel/analytics/react";
import { GoogleTagManager } from "@next/third-parties/google";
import { Suspense } from "react";
import FacebookPixel from "@/app/_components/FacebookPixel";
import { env } from "@/env";
import { getToken } from "@/lib/auth-server";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Cachoeira das Araras",
  description: "Bem vindo a Cachoeira das Araras!",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/favicon.ico",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const initialToken = await getToken();

  return (
    <html lang="pt-BR" className={`${inter.variable}`}>
      <body className="min-h-screen bg-background">
        <ConvexClientProvider initialToken={initialToken}>
          <TRPCReactProvider>{children}</TRPCReactProvider>
        </ConvexClientProvider>
        <Toaster />
        {/* Only enable Analytics if explicitly allowed to avoid Edge requests to /_vercel/insights */}
        {env.NEXT_PUBLIC_ENABLE_ANALYTICS ? <Analytics /> : null}
        <Suspense fallback={null}>
          <FacebookPixel />
        </Suspense>
        <GoogleTagManager gtmId="GTM-TT3T4V5Q" />
      </body>
    </html>
  );
}

import "@/styles/globals.css";
import { TRPCReactProvider } from "@/trpc/react";
import { Toaster } from "@/components/ui/toaster"
import { Inter } from "next/font/google";
import { type Metadata } from "next";
import { GoogleTagManager } from '@next/third-parties/google'

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Cachoeira das Araras",
  description: "Bem vindo a Cachoeira das Araras!",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${inter.variable}`}>
      <body>
        <TRPCReactProvider>{children}</TRPCReactProvider>
        <Toaster />
      </body>
      <GoogleTagManager gtmId="GTM-TT3T4V5Q" />
    </html>
  );
}

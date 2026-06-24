import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { FlaskConical } from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { activeEnv } from "@/lib/db";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Raid Clash Tracker",
  description: "Hydra & Chimera Clash stats for our RAID: Shadow Legends clan",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const isTest = activeEnv() === "test";

  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
      <body className="bg-bg text-text">
        {isTest && (
          <div className="flex items-center justify-center gap-2 bg-gold/15 px-4 py-1.5 text-sm font-medium text-gold">
            <FlaskConical size={15} />
            <span>TEST DATABASE — sandbox data, not your real clan.</span>
            <Link href="/settings" className="underline underline-offset-2 hover:text-text">
              Switch to Production
            </Link>
          </div>
        )}
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 min-w-0 overflow-x-hidden">{children}</main>
        </div>
      </body>
    </html>
  );
}

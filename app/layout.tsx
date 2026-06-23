import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { loadDataset } from "@/lib/data";
import { activeMemberIds } from "@/lib/compute";
import { CLAN_CAP } from "@/lib/constants";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Raid Clash Tracker",
  description: "Hydra & Chimera Clash stats for our RAID: Shadow Legends clan",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const ds = await loadDataset();
  const activeCount = Math.min(activeMemberIds(ds).size, CLAN_CAP);

  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
      <body className="bg-bg text-text">
        <div className="flex min-h-screen">
          <Sidebar activeCount={activeCount} />
          <main className="flex-1 min-w-0 overflow-x-hidden">{children}</main>
        </div>
      </body>
    </html>
  );
}

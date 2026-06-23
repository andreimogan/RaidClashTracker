import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Raid Clash Tracker",
  description: "Hydra & Chimera Clash stats for our RAID: Shadow Legends clan",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
      <body className="bg-bg text-text">
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 min-w-0 overflow-x-hidden">{children}</main>
        </div>
      </body>
    </html>
  );
}

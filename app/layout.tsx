import type { Metadata } from "next";
import { Outfit, Geist_Mono, Cinzel } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { WeekTransitionProvider } from "@/components/WeekTransition";

const outfit = Outfit({ variable: "--font-outfit", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const cinzel = Cinzel({ variable: "--font-cinzel", subsets: ["latin"], weight: ["400", "500", "600", "700"] });

export const metadata: Metadata = {
  title: "Raid Clash Tracker",
  description: "Hydra & Chimera Clash stats for our RAID: Shadow Legends clan",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${outfit.variable} ${geistMono.variable} ${cinzel.variable} antialiased`}>
      <body className="bg-bg text-text">
        {/* Holds the in-flight state of a `?week=` change. TWO controls start
            it — components/TopBar.tsx (the select + both chevrons) and
            components/TimelineStrip.tsx (the week cards) — the week-scoped
            regions read it, and the provider itself renders the app's single
            week live region here, where it can never unmount mid-session.
            Otherwise a pure children passthrough: this layout stays a server
            component and reads NO request-time API — cookies/headers/session
            here would opt /import out of static rendering
            (.claude/rules/rendering.md). */}
        <WeekTransitionProvider>
          <div className="flex min-h-screen">
            <Sidebar />
            <main className="flex-1 min-w-0 overflow-x-hidden">{children}</main>
          </div>
        </WeekTransitionProvider>
      </body>
    </html>
  );
}

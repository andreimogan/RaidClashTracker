"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Flame,
  Cat,
  CalendarRange,
  Users,
  Settings,
} from "lucide-react";

const NAV = [
  { href: "/", label: "Home", icon: LayoutDashboard },
  { href: "/hydra", label: "Hydra", icon: Flame },
  { href: "/chimera", label: "Chimera", icon: Cat },
  { href: "/timeline", label: "Timeline", icon: CalendarRange },
  { href: "/members", label: "Members", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-[76px] shrink-0 flex-col items-center gap-1 border-r border-border bg-panel/80 py-4">
      {/* Circular gold emblem */}
      <Link href="/" className="mb-3 flex flex-col items-center gap-1.5">
        <span className="grid h-11 w-11 place-items-center rounded-full border-2 border-gold/70 bg-panel-2 font-display text-sm font-bold tracking-tight text-gold shadow-[0_0_18px_-6px_var(--color-gold)]">
          RC
        </span>
        <span className="font-display text-[9px] uppercase tracking-[0.2em] text-faint">Tracker</span>
      </Link>

      <nav className="flex w-full flex-col items-center gap-1 px-2">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex w-full flex-col items-center gap-1.5 rounded-lg px-1 py-2.5 transition-colors ${
                active ? "bg-panel-2/70 text-gold" : "text-muted hover:bg-panel-2/40 hover:text-text"
              }`}
            >
              <Icon size={20} className={active ? "text-gold" : ""} />
              <span className="text-[10px] font-medium uppercase tracking-[0.08em]">{label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

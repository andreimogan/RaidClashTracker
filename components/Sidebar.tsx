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
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/hydra", label: "Hydra Clash", icon: Flame },
  { href: "/chimera", label: "Chimera Clash", icon: Cat },
  { href: "/timeline", label: "Timeline", icon: CalendarRange },
  { href: "/members", label: "Members", icon: Users },
  { href: "/settings", label: "Clan Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-panel">
      <div className="flex items-center gap-2 px-5 py-5">
        <span className="rounded bg-gold px-2 py-0.5 text-lg font-extrabold tracking-tight text-bg">
          RAID
        </span>
        <span className="text-[11px] font-semibold leading-tight tracking-widest text-muted">
          CLASH
          <br />
          TRACKER
        </span>
      </div>

      <nav className="mt-2 flex flex-col gap-1 px-3">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-panel-2 text-text"
                  : "text-muted hover:bg-panel-2/60 hover:text-text"
              }`}
            >
              <Icon size={18} className={active ? "text-gold" : ""} />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

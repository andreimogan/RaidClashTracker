"use client";

import { useState, type ReactNode } from "react";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "import", label: "Import data" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function SettingsTabs({
  overview,
  importPanel,
}: {
  overview: ReactNode;
  importPanel: ReactNode;
}) {
  const [tab, setTab] = useState<TabId>("overview");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex w-fit items-center gap-1 rounded-lg border border-border bg-panel-2 p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              tab === t.id ? "bg-panel text-text" : "text-muted hover:text-text"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div>{tab === "overview" ? overview : importPanel}</div>
    </div>
  );
}

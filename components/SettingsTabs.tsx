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
      <div className="pill-group w-fit">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`pill ${tab === t.id ? "pill-active" : ""}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div>{tab === "overview" ? overview : importPanel}</div>
    </div>
  );
}

"use client";

import { Download } from "lucide-react";

export interface ExportData {
  filename: string;
  headers: string[];
  rows: (string | number)[][];
}

export function downloadCsv({ filename, headers, rows }: ExportData) {
  const escape = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers, ...rows].map((r) => r.map(escape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ExportButton({ data }: { data?: ExportData }) {
  return (
    <button
      onClick={() => data && downloadCsv(data)}
      disabled={!data}
      className="flex items-center gap-2 rounded-lg border border-border bg-panel px-3 py-2 text-sm font-medium text-muted enabled:hover:text-text disabled:opacity-40"
    >
      <Download size={15} />
      Export
    </button>
  );
}

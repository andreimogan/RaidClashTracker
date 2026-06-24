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
    <button onClick={() => data && downloadCsv(data)} disabled={!data} className="btn-ghost">
      <Download size={15} />
      Export
    </button>
  );
}

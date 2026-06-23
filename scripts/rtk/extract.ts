// Phase 5 — pull a raw account dump from a locally running RaidToolkit instance
// and save it for inspection. RaidToolkit exposes a WebSocket API at
// wss://localhost:9090 (see https://raidtoolkit.com/pages/get-started/web-api.html).
//
// The exact dump shape is NOT yet verified to contain Hydra/Chimera Clash damage
// history — that's the open risk in the plan. This script's first job is to
// fetch the dump and print its top-level keys so we can confirm what's available.
//
// Prereq:  install RaidToolkit, run it, then `npm install @raid-toolkit/webclient`.
// Usage:   npm run extract
import { mkdirSync, writeFileSync } from "node:fs";

async function getDump(): Promise<unknown> {
  // Lazy import so the main app stays installable even without this package.
  let mod: any;
  try {
    mod = await import("@raid-toolkit/webclient");
  } catch {
    throw new Error(
      "Couldn't load @raid-toolkit/webclient.\n" +
        "Make sure RaidToolkit is installed and running, then:\n" +
        "  npm install @raid-toolkit/webclient",
    );
  }

  // The webclient surface has shifted across versions; try the documented
  // entry points in order. Adjust here once verified against your RTK version.
  const client =
    mod.RaidToolkitClient?.() ??
    mod.createClient?.() ??
    mod.default?.();

  if (!client) {
    throw new Error(
      "Loaded @raid-toolkit/webclient but couldn't find a client constructor.\n" +
        "Inspect the module exports and update scripts/rtk/extract.ts:\n" +
        `  exports: ${Object.keys(mod).join(", ")}`,
    );
  }

  if (typeof client.connect === "function") await client.connect();

  const accountApi = client.AccountApi ?? client.accounts ?? client;
  const accounts =
    (await (accountApi.getAccounts?.() ?? accountApi.GetAccounts?.())) ?? [];
  if (!accounts.length) throw new Error("No RAID accounts reported by RaidToolkit.");

  const id = accounts[0].id ?? accounts[0].Id ?? accounts[0];
  const dump =
    (await (accountApi.getAccountDump?.(id) ?? accountApi.GetAccountDump?.(id)));

  if (typeof client.close === "function") client.close();
  return dump;
}

async function main() {
  const dump = await getDump();
  mkdirSync("data/raw", { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const file = `data/raw/dump-${stamp}.json`;
  writeFileSync(file, JSON.stringify(dump, null, 2));

  console.log(`Saved raw dump → ${file}`);
  if (dump && typeof dump === "object") {
    console.log("Top-level keys:", Object.keys(dump as object).join(", "));
    console.log(
      "\nNext: inspect the dump for clan/clash damage. If present, map it in\n" +
        "scripts/rtk/normalize.ts. If absent, use the CSV path (npm run import).",
    );
  }
}

main().catch((err) => { console.error("Extract failed:", err.message ?? err); process.exit(1); });

import { loadDataset } from "@/lib/data";
import { activeMemberIds } from "@/lib/compute";
import { TopBar, type ExportData } from "@/components/TopBar";
import { RosterTable, type RosterRow } from "@/components/RosterTable";
import { BenchedRosterTable } from "@/components/BenchedRosterTable";
import { formatDamage, formatKeys } from "@/lib/format";

// REQUIRED, not incidental. This roster aggregates every week, so the page reads
// no `searchParams` and renders no week picker — and awaiting `searchParams` is
// the *only* thing that makes the other data pages dynamic (.claude/rules/rendering.md).
// Without this line the page silently prerenders to static HTML: one build's
// roster served to every visitor, or the demo dataset if the build environment
// had no connection string. No error, no warning — the build's route table (`ƒ`,
// not `○`) is the only proof. Do not remove it as dead code. The two client
// roster tables change none of this — they page over rows this server component
// read.
export const dynamic = "force-dynamic";

export default async function MembersPage() {
  const ds = await loadDataset();
  const activeIds = activeMemberIds(ds);

  // Computed here, on the server, and handed to the client leaf as finished
  // rows — `RosterTable` adds paging position and nothing else.
  const summaries: RosterRow[] = ds.members
    .map((member) => {
      const rows = ds.results.filter((r) => r.memberId === member.id);
      const hydra = rows.filter((r) => r.clashType === "hydra");
      const chimera = rows.filter((r) => r.clashType === "chimera");
      const weeksPresent = new Set(rows.map((r) => r.weekId)).size;
      const weeksActive = new Set(rows.filter((r) => r.keysUsed > 0).map((r) => r.weekId)).size;
      const totalKeys = rows.reduce((s, r) => s + r.keysUsed, 0);
      return {
        member,
        isActive: activeIds.has(member.id),
        weeksPresent,
        hydraTotal: hydra.reduce((s, r) => s + r.totalDamage, 0),
        chimeraTotal: chimera.reduce((s, r) => s + r.totalDamage, 0),
        avgKeys: weeksPresent ? totalKeys / weeksPresent : 0,
        participationPct: weeksPresent ? (weeksActive / weeksPresent) * 100 : 0,
      };
    })
    // Current roster first, then by total damage dealt.
    .sort((a, b) => {
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      return b.hydraTotal + b.chimeraTotal - (a.hydraTotal + a.chimeraTotal);
    });

  // A SUBSET VIEW, NOT A PARTITION. `summaries` goes to the Roster below
  // unfiltered, so every player in here is on both cards — the owner's pinned
  // decision: benching does not remove anybody from the clan, it records that
  // they will not take part in events. Derived on the server like every other
  // row on this page; the client leaf adds paging position and nothing else.
  const benched: RosterRow[] = summaries.filter((s) => s.member.isBenched);

  const exportData: ExportData = {
    filename: "members.csv",
    headers: ["Player", "Status", "Weeks", "Hydra Total", "Chimera Total", "Avg Keys/Week", "Participation %"],
    rows: summaries.map((s) => [
      s.member.inGameName,
      s.isActive ? "Active" : "Former",
      s.weeksPresent,
      formatDamage(s.hydraTotal),
      formatDamage(s.chimeraTotal),
      formatKeys(s.avgKeys),
      s.participationPct.toFixed(0),
    ]),
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* No week props: the roster is all-weeks by design (docs/user-guide.md),
          so TopBar renders the title and the CSV export only. */}
      <TopBar title="Members" exportData={exportData} />
      {/* Roster + Benched Roster, 2 + 1, split at `2xl` (1536px) and stacked
          below it — the same grid as the overview's Clan Performance + Black
          List row (app/page.tsx:136), and held back to `2xl` for the same
          measured reason: two of three columns at `xl` would leave the Roster's
          min-w-[820px] grid under a permanent horizontal scrollbar on every
          1280–1500px laptop. At 1536px it gets ~944px and the narrow column
          ~465px, which is ample for a two-column table.

          Both tables are client leaves ONLY because the page index is client
          state — see the header comment in components/RosterTable.tsx. This page
          stays a server component and keeps every derivation above. */}
      <div className="grid grid-cols-1 gap-5 2xl:grid-cols-3">
        <div className="xl:h-full 2xl:col-span-2">
          <RosterTable rows={summaries} />
        </div>
        <div className="xl:h-full">
          <BenchedRosterTable rows={benched} />
        </div>
      </div>
    </div>
  );
}

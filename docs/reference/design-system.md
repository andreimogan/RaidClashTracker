# Design system (living doc)

<!-- Kept current as code changes — updated, not appended. Owner: ui-design-specialist. -->

The look is the **gestal.gg aesthetic**: near-black blue-tinted panels, hairline borders, top-lit gradients, serif display headings, and one warm + one cool accent. It is fully encoded in `app/globals.css` — components consume tokens and primitives, never raw values.

## Tokens (`@theme` in `app/globals.css`)

- **Surfaces:** `bg` `#080b13` · `panel` / `panel-2` · borders `border` `#1b2942`, `border-soft`
- **Text:** `text` `#e8eef6` · `muted` `#8a98ad` · `faint` `#586478`
- **Clash accents:** Hydra = warm amber-bronze (`hydra`, `-dim`, `-bright`); Chimera = steel-blue (`chimera`, `-dim`, `-bright`). Keep this pairing everywhere the two clashes appear.
- **Semantic:** `gold` / `gold-bright` (highlights), `up` green / `down` red (trends)
- **Gradients/edges:** `--grad-card`, `--grad-inset`, `--edge-hi` (glass top edge)
- **Fonts:** `font-sans` = Outfit · `font-display` = Cinzel (headings) · `font-mono` = Geist Mono

## Primitives (`@layer components`)

- `.card` / `.card-flush` — top-lit gradient surface, hairline border, glass edge (flush = no padding)
- `.inset` — recessed metric/field container, one shade darker
- `.fill-hydra` / `.fill-chimera` — data-viz accent fills (bright → deep along the hue); data viz only

## Patterns

- **Dialog (modal):** hand-rolled, no library. A `fixed inset-0 z-50` overlay with `bg-black/60` backdrop centers a `.card` panel (`w-full max-w-sm`). Closes on Escape and backdrop click; the dialog component mounts only while open, so unmounting resets its form state. Title is a `SectionTitle` + a `text-xs text-muted` subtitle; actions are `.btn-accent bg-gold` (with `Loader2` spinner while pending) and `.btn-ghost`; errors render `text-xs text-down` inside the panel. Reference implementation: `components/MemberHistoryTable.tsx` (`EditWeekDialog`).
- **Form fields:** labels use `.stat-label`; inputs use the inline convention `rounded-lg border border-border bg-panel-2 px-3 py-2 text-sm outline-none placeholder:text-faint focus:border-gold/50` (+ `tabular-nums` for numeric values). Clash-scoped field groups get a `font-display` uppercase group header in `text-hydra` / `text-chimera`.
- **Ghost icon button (tables):** `inline-grid h-7 w-7 place-items-center rounded-md border border-border bg-panel-2/50 text-muted hover:border-gold/40 hover:text-gold` with a lucide icon at ~13px and an `aria-label`.
- **Trend indicator (`components/TrendBadge.tsx`):** one signed-percentage badge shared by every trend surface. `ArrowUpRight` + `text-up` when positive, `ArrowDownRight` + `text-down` when negative, `Minus` + `text-faint` inside the ±0.5% dead zone; the number is always formatted with `formatPct(value, true)` from `lib/format.ts`. It accepts `number | null`, and **`null` renders an em-dash in `text-muted`** — three distinct states, deliberately: a flat week is `Minus 0%`, a present week with no baseline is a `text-muted` dash, and an absent week's cells are `text-faint` dashes. Do not collapse the last two: `text-faint` (#586478) on the card gradient is ~3.0:1, which fails WCAG AA at the ~10.5px `text-sm` becomes under the global 75% root font size, while `text-muted` (#8a98ad) is ~6.4:1. What the percentage *measures* is the caller's choice, and it currently differs by surface: the member page's Week-by-Week History compares total damage against the member's most recent prior present week (`deltaPct` in `lib/compute.ts`) — its column is headed **Dmg vs Prev Week** rather than "Trend" precisely because the badge alone can't disclose that — while the Hydra/Chimera clash tables and the per-clash cards compare damage-per-key against the previous global week.

## Rules of use

- **No hardcoded hex colors in components.** New colors become tokens in `@theme` first; new surface treatments become primitives.
- Global `html { font-size: 75% }` scales all rem sizing — use Tailwind `text-*` classes, never px compensation.
- Numeric metrics use `tabular-nums`; section headings use `font-display`.
- Icons: lucide-react. Charts: Recharts, filled with the clash accent tokens.
- Body background carries a fixed radial "lighting" glow — components should not add competing page-level backgrounds.

Reference implementations: `components/ClashCard.tsx` (card + inset + accent theming pattern), `components/PerformanceTable.tsx`, `components/WeeklyBarChart.tsx`, `components/MemberCell.tsx` (the canonical member avatar + linked-name cell — every table that shows a member renders it; `formerStyle="badge"` shows the Former pill, `"muted"` dims the name instead). Design source material lives in `Assets UI/`.

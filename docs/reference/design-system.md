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

**All eleven, so nobody hand-rolls one that already exists.** This list had held only
the first five for several orders, which is how a fourth hand-copy of the form-field
class got written.

- `.card` / `.card-flush` — top-lit gradient surface, hairline border, glass edge (flush = no padding)
- `.inset` — recessed metric/field container, one shade darker
- `.fill-hydra` / `.fill-chimera` — data-viz accent fills (bright → deep along the hue); data viz only
- `.btn-ghost` — the default button: bordered, `bg-panel-2/50`, uppercase `text-xs` with `tracking-[0.12em]`, gold on hover, `disabled:opacity-40`
- `.btn-accent` — the affirmative button. Carries **no background of its own** — it sets `text-bg` and expects the caller to supply the fill (`.btn-accent bg-gold` is the established pairing), so it works for a gold primary and a `bg-down` destructive alike
- `.pill-group` / `.pill` / `.pill-active` — the segmented toggle (clash switch, settings tabs). `.pill-active` is applied *in addition to* `.pill`
- `.stat-label` — the small uppercase label above a metric or form field (`text-[11px]`, `tracking-[0.14em]`, `text-muted`)

## Patterns

- **Dialog (modal):** hand-rolled, no library. A `fixed inset-0 z-50` overlay with `bg-black/60` backdrop centers a `.card` panel (`w-full max-w-sm`). Closes on Escape and backdrop click; the dialog component mounts only while open, so unmounting resets its form state. Title is a `SectionTitle` + a `text-xs text-muted` subtitle; actions are `.btn-accent bg-gold` (with `Loader2` spinner while pending) and `.btn-ghost`; errors render `text-xs text-down` inside the panel. Reference implementation: `components/MemberHistoryTable.tsx` (`EditWeekDialog`).
- **Locked note (a write affordance the reader may not use):** the composition that
  replaces a control rather than disabling it. A `flex items-start gap-3 rounded-xl
  border border-border bg-panel-2/40 p-4` block holding a lucide `Lock` at `size={18}`
  (`mt-0.5 shrink-0 text-muted`) and a single `text-sm text-muted` paragraph. Used
  three times: `components/DataManagement.tsx` (`LockedNote`), `components/ImportPanel.tsx`
  (`ImportLocked`), and — reduced to the bare `text-xs text-muted` sentence, no box, because
  it sits inline in a table header — `components/MemberHistoryTable.tsx`. `components/AvatarEditor.tsx`
  uses the same reduced form beside the avatar. **The copy is chosen by `readOnlyReason`, never
  by `readOnly` alone**, and the two branches are not interchangeable: `"anonymous"` says *sign in*
  and links to `/login`; `"demo"` says *connect the clan database* and shows **no** login link.
  The rule is in `.claude/rules/ux.md` (four permission cells, not three) and the reasoning in
  `docs/reference/auth.md`. **Hidden, never disabled** — a disabled control still advertises the
  endpoint behind it, which is why the `/api/backup` link is absent from the tree rather than greyed.
- **Form fields:** labels use `.stat-label`; inputs use the inline convention `w-full rounded-lg border border-border bg-panel-2 px-3 py-2 text-sm outline-none placeholder:text-faint focus:border-gold/50` (+ `tabular-nums` for numeric values). Clash-scoped field groups get a `font-display` uppercase group header in `text-hydra` / `text-chimera`. **It is a convention, not a primitive, and it is hand-copied in four places** — `components/MemberHistoryTable.tsx:190` and `app/login/LoginForm.tsx:8` both hoist it to a local `INPUT_CLS` const (identical strings); `components/DataManagement.tsx:78` and `components/ImportPanel.tsx:312` inline it. **The focus ring is the one part that varies on purpose, and it is semantic:** `focus:border-gold/50` is the default, `focus:border-down/50` marks the destructive type-`RESET` field, `focus:border-chimera/50` marks the JSON paste area (which also takes `font-mono text-xs`). Promoting this to a `.field` primitive in `app/globals.css` would collapse the four copies — a real cleanup, but it must keep the accent overridable or it flattens that distinction.
- **Ghost icon button (tables):** `inline-grid h-7 w-7 place-items-center rounded-md border border-border bg-panel-2/50 text-muted hover:border-gold/40 hover:text-gold` with a lucide icon at ~13px and an `aria-label`.
- **Trend indicator (`components/TrendBadge.tsx`):** one signed-percentage badge shared by every trend surface. `ArrowUpRight` + `text-up` when positive, `ArrowDownRight` + `text-down` when negative, `Minus` + `text-faint` inside the ±0.5% dead zone; the number is always formatted with `formatPct(value, true)` from `lib/format.ts`. It accepts `number | null`, and **`null` renders an em-dash in `text-muted`** — three distinct states, deliberately: a flat week is `Minus 0%`, a present week with no baseline is a `text-muted` dash, and an absent week's cells are `text-faint` dashes. Do not collapse the last two: `text-faint` (#586478) on the card gradient is ~3.0:1, which fails WCAG AA at the ~10.5px `text-sm` becomes under the global 75% root font size, while `text-muted` (#8a98ad) is ~6.4:1. What the percentage *measures* is the caller's choice, and it currently differs by surface: the member page's Week-by-Week History compares total damage against the member's most recent prior present week (`deltaPct` in `lib/compute.ts`) — its column is headed **Dmg vs Prev Week** rather than "Trend" precisely because the badge alone can't disclose that — while the Hydra/Chimera clash tables and the per-clash cards compare damage-per-key against the previous global week.

## Rules of use

- **No hardcoded hex colors in components.** New colors become tokens in `@theme` first; new surface treatments become primitives.
- Global `html { font-size: 75% }` scales all rem sizing — use Tailwind `text-*` classes, never px compensation.
- Numeric metrics use `tabular-nums`; section headings use `font-display`.
- Icons: lucide-react. Charts: Recharts, filled with the clash accent tokens.
- Body background carries a fixed radial "lighting" glow — components should not add competing page-level backgrounds.

Reference implementations: `components/ClashCard.tsx` (card + inset + accent theming pattern), `components/PerformanceTable.tsx`, `components/WeeklyBarChart.tsx`, `components/MemberCell.tsx` (the canonical member avatar + linked-name cell — every table that shows a member renders it; `formerStyle="badge"` shows the Former pill, `"muted"` dims the name instead). Design source material lives in `Assets UI/`.

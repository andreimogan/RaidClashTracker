---
paths:
  - "components/**"
  - "app/**"
---

UX checklist for user-facing surfaces (enforced on review by `ux-specialist`; implementers should self-check against it):

- **State coverage** — every data surface handles **five** states, and the first two are the pair most easily conflated:
  - **Connected but empty** — the database is reachable and migrated, there are just no rows yet (fresh `npm run db:migrate`, or the user pressed Reset in Settings). Renders *genuinely empty*, and **writes work** — so an empty surface here must not borrow demo mode's read-only copy or imply anything is missing but a first import.
  - **Demo mode** — no `DATABASE_URL`, or the tables don't exist yet (`42P01`) → the bundled sample dataset, **read-only**. Must say the numbers are not the clan's. A user can move between this state and the one above without touching a config file (Reset), so the two must never look alike.
  - **Loading / pending** — in-flight reads and mutations.
  - **In-place error** — one fetch or save failed; the surface stays usable and surfaces the reason where the action was.
  - **Connection failure** — the render itself throws (wrong password, DNS, paused project, pooler exhaustion) and the root `app/error.tsx` boundary takes over the whole page with a retry. **No surface may fall back to demo data here** — that is the invariant `lib/data.ts`'s `42P01`-or-no-URL allowlist exists to protect, and the copy's job is to say the other pages' numbers are neither stale nor invented.
  Never render an action that cannot succeed in the current state; hide or disable it with a reason (precedent: pencils hidden + read-only note in `MemberHistoryTable`).
- **Feedback** — after a mutation, reflect the result: the app's convention is POST → check `res.ok && data.ok` → `router.refresh()`, with a pending spinner (`Loader2`) and errors surfaced in-place (`text-xs text-down`, `whitespace-pre-line` for multi-line messages). Don't leave an action with no visible outcome.
- **Destructive / lossy actions** — confirm before irreversible or data-losing operations (precedent: type-`RESET` confirm; overwrite-confirm on import). Avoid silently writing rounded/derived values back over exact stored data.
- **Accessibility** — modals: initial focus inside, focus trap while open, restore focus on close, Escape to dismiss, `role="dialog"` + `aria-modal`. Icon-only buttons need `aria-label`. Keyboard-operate every control. **Contrast: `text-faint` (`--color-faint #586478`) measures ~3.05:1 on card surfaces and cannot reach WCAG AA at any size used here** — `html { font-size: 75% }` puts `text-xs` at ~10.5px, far below the large-text exemption. `text-muted` measures ~6.23:1 and passes. So `text-faint` is for genuinely decorative text only; **never use it for anything the reader needs** (instructions, error explanations, labels on a value they must act on). Measured 2026-08-12; existing `text-faint` uses in `components/MemberHistoryTable.tsx` are known debt, queued for the demo/empty-state UX order.
- **Content & clarity** — labels and microcopy legible to non-power-user clanmates; keep RAID/clash terminology consistent with `ONBOARDING.md` / `TUTORIAL.md`.

This is a review lens, not an ownership grant — `ux-specialist` reports; `ui-design-specialist` (or the owning implementer) makes the changes.

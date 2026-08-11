---
paths:
  - "components/**"
  - "app/**"
---

UX checklist for user-facing surfaces (enforced on review by `ux-specialist`; implementers should self-check against it):

- **State coverage** — every data surface handles all four states: empty (no weeks/members yet), loading/pending, error (failed fetch/save), and **demo mode** (DB not initialized → read-only). Never render an action that cannot succeed in the current state; hide or disable it with a reason (precedent: pencils hidden + read-only note in `MemberHistoryTable`, DB-switch disabled under `envOverride`).
- **Feedback** — after a mutation, reflect the result: the app's convention is POST → check `res.ok && data.ok` → `router.refresh()`, with a pending spinner (`Loader2`) and errors surfaced in-place (`text-xs text-down`, `whitespace-pre-line` for multi-line messages). Don't leave an action with no visible outcome.
- **Destructive / lossy actions** — confirm before irreversible or data-losing operations (precedent: type-`RESET` confirm; overwrite-confirm on import). Avoid silently writing rounded/derived values back over exact stored data.
- **Accessibility** — modals: initial focus inside, focus trap while open, restore focus on close, Escape to dismiss, `role="dialog"` + `aria-modal`. Icon-only buttons need `aria-label`. Keyboard-operate every control. Check contrast against the dark tokens (`text-muted`/`text-faint` on `panel` surfaces).
- **Content & clarity** — labels and microcopy legible to non-power-user clanmates; keep RAID/clash terminology consistent with `ONBOARDING.md` / `TUTORIAL.md`.

This is a review lens, not an ownership grant — `ux-specialist` reports; `ui-design-specialist` (or the owning implementer) makes the changes.

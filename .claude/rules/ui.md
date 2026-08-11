---
paths:
  - "components/**"
  - "app/**"
---

- Style only with the design tokens and primitives defined in `app/globals.css` (`@theme` block): surfaces via `.card` / `.card-flush` / `.inset`, data-viz fills via `.fill-hydra` / `.fill-chimera`, colors via `text-hydra`, `text-chimera`, `text-muted`, `text-faint`, `border-border`, etc. **Never hardcode hex colors** in components.
- Hydra is warm amber-bronze, Chimera is steel-blue — keep the clash accent pairing consistent everywhere.
- Headings use `font-display` (Cinzel); numeric metrics use `tabular-nums`. Body font is Outfit via `font-sans`.
- Global `html { font-size: 75% }` scales all rem-based `text-*` classes — size with Tailwind's rem classes, don't compensate with px values.
- Icons come from `lucide-react`.
- Pages are server components by default; they read via `loadDataset()` in `lib/data.ts` and compute metrics with `lib/compute.ts`. Client components are opt-in and stay leaf-level.
- This Next.js version has breaking changes vs. training data — read the relevant guide in `node_modules/next/dist/docs/` before writing route, layout, or API-route code.
- The living doc for this area is `docs/reference/design-system.md` — update it when tokens/primitives change.

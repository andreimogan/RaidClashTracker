// Gold Cinzel small-caps section header with a leading diamond bullet,
// gestal.gg-style. `tone` colors the text + diamond for clash sections.
const TONE = {
  gold: "text-gold",
  hydra: "text-hydra",
  chimera: "text-chimera",
} as const;

const DIAMOND = {
  gold: "bg-gold/70",
  hydra: "bg-hydra/70",
  chimera: "bg-chimera/70",
} as const;

export function SectionTitle({
  children,
  tone = "gold",
  className = "",
}: {
  children: React.ReactNode;
  tone?: keyof typeof TONE;
  className?: string;
}) {
  return (
    <h2
      className={`flex items-center gap-2.5 font-display text-sm font-semibold uppercase tracking-[0.18em] ${TONE[tone]} ${className}`}
    >
      <span className={`inline-block h-1.5 w-1.5 rotate-45 ${DIAMOND[tone]}`} />
      {children}
    </h2>
  );
}

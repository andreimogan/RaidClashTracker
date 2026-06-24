// Gold Roman-caps (Cinzel) page title, gestal.gg-style.
export function PageTitle({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <h1 className={`font-display text-2xl font-semibold uppercase tracking-[0.14em] text-gold ${className}`}>
      {children}
    </h1>
  );
}

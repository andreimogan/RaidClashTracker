// Deterministic initial-based avatar (the game champion portraits aren't
// available, so we render a colored monogram instead).

const GRADIENTS = [
  "from-emerald-500 to-teal-700",
  "from-violet-500 to-purple-800",
  "from-rose-500 to-red-800",
  "from-amber-500 to-orange-700",
  "from-sky-500 to-blue-800",
  "from-fuchsia-500 to-pink-800",
  "from-lime-500 to-green-800",
  "from-indigo-500 to-indigo-900",
];

function hash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

function initials(name: string): string {
  const cleaned = name.replace(/[^\p{L}\p{N} ]/gu, "").trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  const base = parts.length ? parts : [name];
  return (base[0]?.[0] ?? "?").toUpperCase();
}

const RINGS: Record<string, string> = {
  gold: "ring-2 ring-gold",
  hydra: "ring-2 ring-hydra",
  chimera: "ring-2 ring-chimera",
  none: "",
};

export function Avatar({
  name,
  size = 32,
  badge,
  ring = "none",
}: {
  name: string;
  size?: number;
  badge?: number | string;
  ring?: keyof typeof RINGS;
}) {
  const grad = GRADIENTS[hash(name) % GRADIENTS.length];
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div
        className={`flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br ${grad} font-semibold text-white ${RINGS[ring]}`}
        style={{ fontSize: size * 0.42 }}
      >
        {initials(name)}
      </div>
      {badge !== undefined && (
        <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-sm bg-bg/90 px-1 text-[9px] font-semibold text-gold">
          {badge}
        </span>
      )}
    </div>
  );
}

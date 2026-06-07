// Operator Profile — pillar/level/rank config

export type PillarId =
  | "firearms"
  | "combatives"
  | "protective_ops"
  | "fieldcraft"
  | "medical"
  | "tactics";

export type PillarMeta = {
  id: PillarId;
  name: string;
  short: string;
  emoji: string;
  blurb: string;
  /** tailwind text-color class for accents */
  accent: string;
};

export const PILLARS: PillarMeta[] = [
  { id: "firearms",       name: "Firearms",              short: "FRMS", emoji: "🔫", blurb: "Pistol, rifle, CCW, long-range, defensive shooting", accent: "text-amber-500" },
  { id: "combatives",     name: "Combatives",            short: "CMBT", emoji: "🥊", blurb: "Hand-to-hand, BJJ, Krav, knife defense",            accent: "text-rose-500" },
  { id: "protective_ops", name: "Protective Ops",        short: "PROT", emoji: "🛡️", blurb: "Executive protection, security, threat assessment", accent: "text-sky-500" },
  { id: "fieldcraft",     name: "Fieldcraft",            short: "FLD",  emoji: "🧭", blurb: "Land nav, survival, tracking, bushcraft",          accent: "text-emerald-500" },
  { id: "medical",        name: "Medical",               short: "MED",  emoji: "🚑", blurb: "TCCC, Stop the Bleed, trauma care",                accent: "text-red-500" },
  { id: "tactics",        name: "Tactics & Mindset",     short: "TAC",  emoji: "🧠", blurb: "Force-on-force, decision-making, awareness",        accent: "text-violet-500" },
];

export const PILLAR_BY_ID: Record<PillarId, PillarMeta> = PILLARS.reduce(
  (acc, p) => ({ ...acc, [p.id]: p }),
  {} as Record<PillarId, PillarMeta>,
);

// Tier thresholds (XP at which the level begins)
export const LEVEL_TIERS = [
  { level: 0, label: "UNTRAINED",   min: 0,    max: 0    },
  { level: 1, label: "NOVICE",      min: 1,    max: 99   },
  { level: 2, label: "TRAINED",     min: 100,  max: 299  },
  { level: 3, label: "PROFICIENT",  min: 300,  max: 599  },
  { level: 4, label: "ADVANCED",    min: 600,  max: 999  },
  { level: 5, label: "OPERATOR",    min: 1000, max: Infinity },
] as const;

export type LevelInfo = {
  level: number;
  label: string;
  current: number;        // xp into the current tier
  needed: number;         // xp the tier requires (max-min+1)
  toNext: number | null;  // xp until next level (null if maxed)
  pctToNext: number;      // 0-100
  totalXp: number;
};

export function getLevelInfo(xp: number): LevelInfo {
  const safe = Math.max(0, Math.floor(xp || 0));
  const tier =
    LEVEL_TIERS.slice().reverse().find((t) => safe >= t.min) ?? LEVEL_TIERS[0];
  const next = LEVEL_TIERS.find((t) => t.level === tier.level + 1) ?? null;
  if (!next) {
    return {
      level: tier.level,
      label: tier.label,
      current: safe - tier.min,
      needed: 0,
      toNext: null,
      pctToNext: 100,
      totalXp: safe,
    };
  }
  const span = next.min - tier.min;
  const into = safe - tier.min;
  return {
    level: tier.level,
    label: tier.label,
    current: into,
    needed: span,
    toNext: next.min - safe,
    pctToNext: span > 0 ? Math.min(100, Math.round((into / span) * 100)) : 0,
    totalXp: safe,
  };
}

// Ranking system removed — only the raw TacLink Score is shown.


export function computeTaclinkScore(pillarTotals: Record<PillarId, number>): number {
  const sum = PILLARS.reduce((s, p) => s + (pillarTotals[p.id] || 0), 0);
  return Math.round(sum / PILLARS.length);
}

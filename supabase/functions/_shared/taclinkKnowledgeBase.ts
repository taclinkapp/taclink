// TacLink knowledge base — injected into every SEO article system prompt.
//
// HYBRID MODEL: facts the AI can safely write from public sources are
// filled in. Items only the operator knows (specific state regs,
// instructor pain points from interviews, internal pricing decisions)
// are marked TODO and should be filled by hand. The AI is instructed to
// NOT invent specifics for TODO items — it will speak in general terms.

export const TACLINK_KB = {
  brand: {
    name: "TacLink",
    url: "https://taclink.app",
    one_liner:
      "TacLink connects students with credential-verified firearms, tactical, self-defense, and combatives instructors across North America.",
    differentiators: [
      "Every instructor's credentials (military, LE, NRA, USCCA, state CCW, medical, etc.) are reviewed before they can list courses.",
      "Escrow-based payments — the instructor only gets paid after the student attends.",
      "Discipline-specific search (pistol, rifle, shotgun, combatives, tactical medical, hunting, and more) instead of generic listings.",
      "Geographic search by US state with local-instructor landing pages.",
      "QR-code check-in for verified attendance, eliminating no-show disputes.",
    ],
  },

  audience: {
    primary: [
      "First-time gun owners looking for serious, structured instruction (not range-day plinking).",
      "Concealed-carry permit holders pursuing recurrent training.",
      "Hunters preparing for season — marksmanship, field medical, navigation.",
      "Women seeking female instructors or female-friendly classes.",
      "Working professionals (LEO, EMS, contractors) seeking continuing education.",
    ],
    common_pain_points: [
      "Instructor credentials are unverifiable on Instagram / Facebook groups.",
      "Local ranges only teach one discipline and rarely vet outside instructors.",
      "Pricing is opaque — students don't know if $300 for an 8-hour class is fair.",
      "No accountability mechanism when an instructor cancels or no-shows.",
      // TODO: add the 2-3 specific complaints you've heard most from beta users
    ],
  },

  disciplines: [
    "Pistol (defensive, competition, concealed carry)",
    "Rifle (carbine, precision, hunting)",
    "Shotgun (defensive, sporting clays, upland)",
    "Combatives & unarmed self-defense",
    "Tactical medical (TCCC, Stop the Bleed, individual first aid)",
    "Hunting (firearms safety, field skills, ethics)",
    "Force-on-force / scenario training",
  ],

  regulatory_context: {
    federal: [
      "Federal law sets the floor: 18 USC 922 (prohibited persons), GCA/NFA (item categories), and ATF rules on transfers.",
      "There is no federal mandate for civilian firearm training before purchase.",
    ],
    state_landscape:
      "State requirements diverge sharply. Some states (e.g. Illinois, Massachusetts, New York) require state-approved training before a permit. Others (e.g. constitutional-carry states) require none. Always tell the reader to verify their own state's current rules with the issuing authority — do not state specific hour counts unless you are certain they are current.",
    // TODO: paste the 3-5 states most relevant to your audience with the
    // exact current hour/curriculum requirements, sourced from each state's
    // licensing agency page. The AI should not invent these.
    state_specifics_todo: true,
  },

  pricing_norms: {
    typical_ranges: [
      "Half-day group pistol class: $125 - $250 per student.",
      "Full-day group carbine or defensive pistol: $250 - $500.",
      "Multi-day intensive (2-3 days): $600 - $1,500.",
      "1-on-1 private instruction: $100 - $200 per hour.",
    ],
    note: "These are national ranges from public course pages as of 2025. Regional variation is large. Do not state TacLink-specific instructor pricing.",
  },

  internal_links: {
    discover_instructors: "https://taclink.app/student/discover",
    blog: "https://taclink.app/blog",
    home: "https://taclink.app",
    // Discipline and state landing pages follow these patterns:
    discipline_pattern: "https://taclink.app/discipline/{slug}",
    state_pattern: "https://taclink.app/train/{state-slug}",
  },

  voice_rules: [
    "Speak the way a serious instructor talks to a serious student. No hype. No 'in today's world'. No 'unleash your inner warrior'.",
    "Respect the discipline. Firearms training is not a hobby column.",
    "Cite limits of your knowledge. If a regulation question depends on jurisdiction, say so and tell the reader where to verify.",
    "Never invent specific numbers (hours required, exact pricing for a named instructor, training fatality stats). Use ranges and clearly mark them as ranges.",
  ],
};

export function buildResearchContext(opts: {
  topic: string;
  target_keyword?: string;
  location?: string;
}): string {
  const kb = TACLINK_KB;
  const lines: string[] = [
    "## TacLink Knowledge Base (use as authoritative context — do NOT contradict)",
    "",
    `**Brand**: ${kb.brand.name} — ${kb.brand.one_liner}`,
    `**URL**: ${kb.brand.url}`,
    "",
    "**Why TacLink is different (weave 1-2 of these in naturally — do not list them):**",
    ...kb.brand.differentiators.map((d) => `- ${d}`),
    "",
    "**Who reads this** (one of these is your audience for this article):",
    ...kb.audience.primary.map((p) => `- ${p}`),
    "",
    "**Pain points to acknowledge** (don't invent new ones):",
    ...kb.audience.common_pain_points.map((p) => `- ${p}`),
    "",
    "**Disciplines TacLink covers**:",
    ...kb.disciplines.map((d) => `- ${d}`),
    "",
    "**Regulatory framing** (be careful — do NOT state specific hour counts or curriculum requirements unless given in this KB):",
    ...kb.regulatory_context.federal.map((f) => `- ${f}`),
    `- ${kb.regulatory_context.state_landscape}`,
    kb.regulatory_context.state_specifics_todo
      ? "- For state-specific rules, speak in general terms and tell the reader to verify with their state's issuing authority. Do NOT invent hour counts."
      : "",
    "",
    "**Typical national pricing ranges** (cite as ranges, never as TacLink-specific):",
    ...kb.pricing_norms.typical_ranges.map((p) => `- ${p}`),
    `- Note: ${kb.pricing_norms.note}`,
    "",
    "**Internal links to use when contextually appropriate**:",
    `- Browse verified instructors: ${kb.internal_links.discover_instructors}`,
    `- Blog index: ${kb.internal_links.blog}`,
    `- Discipline pages: ${kb.internal_links.discipline_pattern}`,
    `- State pages: ${kb.internal_links.state_pattern}`,
    "",
    "**Voice rules (non-negotiable)**:",
    ...kb.voice_rules.map((v) => `- ${v}`),
    "",
    `## This article's parameters`,
    `- Topic / working title: ${opts.topic}`,
    opts.target_keyword ? `- Primary keyword: ${opts.target_keyword}` : "",
    opts.location ? `- Geographic focus: ${opts.location}` : "",
  ].filter(Boolean);

  return lines.join("\n");
}

export function countWords(markdown: string): number {
  // Strip code fences, images, and link URLs; count remaining word tokens.
  const stripped = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_`~\-]/g, " ");
  const tokens = stripped.trim().split(/\s+/).filter(Boolean);
  return tokens.length;
}

export const MIN_ARTICLE_WORDS = 1500;

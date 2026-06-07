// Post-processes article markdown to:
//  1. Auto-link the first mention of each US state, discipline, and a few
//     brand terms to the matching SEO landing page.
//  2. Split the body at the first H2 so a mid-article CTA can be inserted.
//
// Replacements skip fenced code blocks, inline code, existing markdown
// links, image syntax, and headings (so we don't break anchor slugs).

import { US_STATES } from "@/lib/seoLanding";
import { COURSE_CATALOG } from "@/lib/courseCatalog";
import { disciplineSlug } from "@/lib/seoLanding";

type Term = { match: RegExp; href: string };

function buildTerms(): Term[] {
  const terms: Term[] = [];
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  // State full names (skip 2-letter codes — too noisy).
  for (const s of US_STATES) {
    terms.push({
      match: new RegExp(`\\b${esc(s.name)}\\b`),
      href: `/train/${s.slug}`,
    });
  }

  // Disciplines — match the full label AND a few short, distinctive keys.
  for (const c of COURSE_CATALOG) {
    const slug = disciplineSlug(c.key);
    terms.push({
      match: new RegExp(`\\b${esc(c.label)}\\b`),
      href: `/discipline/${slug}`,
    });
    // Short key alias, only when it's a real word (skip "Other", "Specialty"
    // and any key already inside the label string we just added).
    const distinctive = ["Pistol", "Rifle", "Shotgun", "Combatives", "Tactical", "Medical", "Hunting"];
    if (distinctive.includes(c.key)) {
      terms.push({
        match: new RegExp(`\\b${esc(c.key)}\\b`),
        href: `/discipline/${slug}`,
      });
    }
  }

  // Brand / product terms.
  terms.push({ match: /\bverified instructors?\b/i, href: "/student/discover" });
  terms.push({ match: /\bbrowse instructors?\b/i, href: "/student/discover" });

  return terms;
}

const TERMS = buildTerms();

// Replace the first occurrence of each term across the whole markdown, but
// only inside plain prose lines.
export function linkifyMarkdown(md: string): string {
  const lines = md.split("\n");
  const used = new Set<string>();
  let inFence = false;

  return lines
    .map((line) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("```") || trimmed.startsWith("~~~")) {
        inFence = !inFence;
        return line;
      }
      if (inFence) return line;
      // Skip headings, images, list markers' link-only lines.
      if (/^\s*#{1,6}\s/.test(line)) return line;
      if (/^\s*!\[/.test(line)) return line;

      let out = line;
      for (const t of TERMS) {
        if (used.has(t.href)) continue;
        // Don't touch inline code or existing links.
        if (!t.match.test(out)) continue;
        // Verify the match isn't inside `code` or [text](url).
        const idx = out.search(t.match);
        if (idx === -1) continue;
        if (isInsideProtected(out, idx)) continue;

        out = out.replace(t.match, (m) => `[${m}](${t.href})`);
        used.add(t.href);
      }
      return out;
    })
    .join("\n");
}

function isInsideProtected(line: string, idx: number): boolean {
  // Inline code spans: count backticks before idx.
  const before = line.slice(0, idx);
  const ticks = (before.match(/`/g) || []).length;
  if (ticks % 2 === 1) return true;
  // Inside a markdown link's [text] or (url).
  let depth = 0;
  for (let i = 0; i < idx; i++) {
    const ch = line[i];
    if (ch === "[" || ch === "(") depth++;
    else if (ch === "]" || ch === ")") depth = Math.max(0, depth - 1);
  }
  return depth > 0;
}

// Returns [beforeFirstH2, fromFirstH2Onward]. If there is no H2, everything
// goes into the second half so the CTA still lands after the intro.
export function splitAtFirstH2(md: string): [string, string] {
  const lines = md.split("\n");
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t.startsWith("```") || t.startsWith("~~~")) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    if (/^##\s/.test(t)) {
      return [lines.slice(0, i).join("\n"), lines.slice(i).join("\n")];
    }
  }
  // No H2 — split at ~50% by paragraph boundary.
  const mid = Math.floor(lines.length / 2);
  for (let i = mid; i < lines.length; i++) {
    if (lines[i].trim() === "") {
      return [lines.slice(0, i).join("\n"), lines.slice(i + 1).join("\n")];
    }
  }
  return [md, ""];
}

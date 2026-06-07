// Generates public/sitemap.xml from static routes + published blog articles
// + SEO landing pages (US states, disciplines, instructor profiles).
// Runs before `vite dev` and `vite build` via predev/prebuild npm hooks.

import { writeFileSync } from "fs";
import { resolve } from "path";

const BASE_URL = "https://taclink.app";
const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL || "https://jocnlpkbaqmriedmbocl.supabase.co";
// Publishable key is safe to embed; RLS limits results to published rows.
const PUBLISHABLE_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpvY25scGtiYXFtcmllZG1ib2NsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczNTA5ODAsImV4cCI6MjA5MjkyNjk4MH0.aE9ufZZiRCQWvR6AboPMuu3kkVYDNDpceLfyqdEmaXg";

interface Entry {
  path: string;
  lastmod?: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

const staticEntries: Entry[] = [
  { path: "/", changefreq: "weekly", priority: "1.0" },
  { path: "/instructor", changefreq: "weekly", priority: "0.9" },
  { path: "/student", changefreq: "weekly", priority: "0.9" },
  { path: "/student/discover", changefreq: "daily", priority: "0.8" },
  { path: "/blog", changefreq: "daily", priority: "0.9" },
  { path: "/faq", changefreq: "monthly", priority: "0.7" },
  { path: "/auth/signin", changefreq: "monthly", priority: "0.5" },
  { path: "/auth/instructor-signup", changefreq: "monthly", priority: "0.7" },
  { path: "/auth/student-signup", changefreq: "monthly", priority: "0.7" },
  { path: "/legal/privacy", changefreq: "monthly", priority: "0.4" },
  { path: "/legal/terms", changefreq: "monthly", priority: "0.4" },
  { path: "/legal/cancellations", changefreq: "monthly", priority: "0.3" },
  { path: "/support", changefreq: "monthly", priority: "0.5" },
  { path: "/support/contact", changefreq: "monthly", priority: "0.5" },
  { path: "/affiliate", changefreq: "monthly", priority: "0.5" },
];

async function fetchArticles(): Promise<Entry[]> {
  try {
    const url = `${SUPABASE_URL}/rest/v1/seo_articles?status=eq.published&select=slug,updated_at,published_at&order=published_at.desc&limit=1000`;
    const res = await fetch(url, {
      headers: { apikey: PUBLISHABLE_KEY, Authorization: `Bearer ${PUBLISHABLE_KEY}` },
    });
    if (!res.ok) {
      console.warn(`[sitemap] failed to fetch articles (${res.status}); skipping`);
      return [];
    }
    const rows: Array<{ slug: string; updated_at: string; published_at: string }> =
      await res.json();
    return rows.map((r) => ({
      path: `/blog/${r.slug}`,
      lastmod: (r.updated_at || r.published_at || "").slice(0, 10),
      changefreq: "monthly" as const,
      priority: "0.7",
    }));
  } catch (e) {
    console.warn("[sitemap] error fetching articles:", e);
    return [];
  }
}

function render(entries: Entry[]) {
  const urls = entries.map((e) =>
    [
      `  <url>`,
      `    <loc>${BASE_URL}${e.path}</loc>`,
      e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
      e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
      e.priority ? `    <priority>${e.priority}</priority>` : null,
      `  </url>`,
    ]
      .filter(Boolean)
      .join("\n"),
  );
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...urls,
    `</urlset>`,
  ].join("\n");
}

const US_STATE_SLUGS = [
  "alabama","alaska","arizona","arkansas","california","colorado","connecticut","delaware",
  "florida","georgia","hawaii","idaho","illinois","indiana","iowa","kansas","kentucky",
  "louisiana","maine","maryland","massachusetts","michigan","minnesota","mississippi",
  "missouri","montana","nebraska","nevada","new-hampshire","new-jersey","new-mexico",
  "new-york","north-carolina","north-dakota","ohio","oklahoma","oregon","pennsylvania",
  "rhode-island","south-carolina","south-dakota","tennessee","texas","utah","vermont",
  "virginia","washington","west-virginia","wisconsin","wyoming","district-of-columbia",
];

const DISCIPLINE_SLUGS = [
  "pistol","rifle","shotgun","multi-platform","concealed-carry-and-legal","combatives",
  "tactical","medical","security-and-ep","law-enforcement","hunting-and-field",
  "youth-and-family","specialty","other",
];

const stateEntries: Entry[] = US_STATE_SLUGS.map((slug) => ({
  path: `/train/${slug}`,
  changefreq: "weekly",
  priority: "0.7",
}));

const disciplineEntries: Entry[] = DISCIPLINE_SLUGS.map((slug) => ({
  path: `/discipline/${slug}`,
  changefreq: "weekly",
  priority: "0.7",
}));

async function fetchInstructorIds(): Promise<Entry[]> {
  try {
    // Distinct instructor_ids from published courses
    const url = `${SUPABASE_URL}/rest/v1/courses?status=eq.published&select=instructor_id&limit=1000`;
    const res = await fetch(url, {
      headers: { apikey: PUBLISHABLE_KEY, Authorization: `Bearer ${PUBLISHABLE_KEY}` },
    });
    if (!res.ok) {
      console.warn(`[sitemap] failed to fetch instructor ids (${res.status}); skipping`);
      return [];
    }
    const rows: Array<{ instructor_id: string }> = await res.json();
    const ids = Array.from(new Set(rows.map((r) => r.instructor_id).filter(Boolean)));
    return ids.map((id) => ({
      path: `/instructors/${id}`,
      changefreq: "weekly" as const,
      priority: "0.6",
    }));
  } catch (e) {
    console.warn("[sitemap] error fetching instructor ids:", e);
    return [];
  }
}

(async () => {
  const [articleEntries, instructorEntries] = await Promise.all([
    fetchArticles(),
    fetchInstructorIds(),
  ]);
  const all = [
    ...staticEntries,
    ...stateEntries,
    ...disciplineEntries,
    ...articleEntries,
    ...instructorEntries,
  ];
  writeFileSync(resolve("public/sitemap.xml"), render(all));
  console.log(
    `sitemap.xml written (${all.length} entries; ${stateEntries.length} states, ${disciplineEntries.length} disciplines, ${articleEntries.length} articles, ${instructorEntries.length} instructors)`,
  );
})();


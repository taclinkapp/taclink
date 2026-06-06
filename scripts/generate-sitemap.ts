// Generates public/sitemap.xml from static routes + published blog articles.
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

(async () => {
  const articleEntries = await fetchArticles();
  const all = [...staticEntries, ...articleEntries];
  writeFileSync(resolve("public/sitemap.xml"), render(all));
  console.log(`sitemap.xml written (${all.length} entries; ${articleEntries.length} articles)`);
})();

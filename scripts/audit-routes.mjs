#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Route audit:
 *   - Parses every <Route path="..."> from src/App.tsx
  *   - Greps every backTo="...", to="...", navigate("..."), nav("..."), href="/..."
 *     in src/ that uses a literal string starting with "/"
 *   - Reports any link that points at a path with no matching route
 *
 * Exits 1 if dead links are found. Wire into CI to block deploys.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const SRC = "src";
const APP = "src/App.tsx";

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const s = statSync(p);
    if (s.isDirectory()) out.push(...walk(p));
    else if (/\.(tsx?|jsx?)$/.test(p) && !/\.test\./.test(p)) out.push(p);
  }
  return out;
}

function loadRoutes() {
  const src = readFileSync(APP, "utf8");
  // Walk the file, tracking a stack of parent <Route path="..."> elements so
  // nested children compose into their full absolute path.
  const tokenRe =
    /<Route\b([^>]*?)(\/?)>|<\/Route>/g;
  const pathRe = /\bpath=["'`]([^"'`]+)["'`]/;
  const routes = new Set();
  const stack = []; // array of parent absolute paths
  let m;
  while ((m = tokenRe.exec(src))) {
    const full = m[0];
    if (full === "</Route>") {
      stack.pop();
      continue;
    }
    const attrs = m[1] || "";
    const selfClose = m[2] === "/";
    const pm = pathRe.exec(attrs);
    let absolute = stack[stack.length - 1] ?? "";
    if (pm) {
      const p = pm[1];
      if (p.startsWith("/")) absolute = p;
      else absolute = (absolute.endsWith("/") ? absolute.slice(0, -1) : absolute) + "/" + p;
      routes.add(absolute);
    }
    if (!selfClose) stack.push(absolute);
  }
  return [...routes];
}

function pathMatchesRoute(linkPath, routes) {
  // strip query/hash
  const p = linkPath.split("?")[0].split("#")[0];
  if (p === "/" || p === "") return routes.includes("/");
  const linkSegs = p.split("/").filter(Boolean);
  for (const route of routes) {
    if (route === "*") continue;
    const rSegs = route.split("/").filter(Boolean);
    if (rSegs.length !== linkSegs.length) continue;
    let ok = true;
    for (let i = 0; i < rSegs.length; i++) {
      if (rSegs[i].startsWith(":")) continue;
      if (rSegs[i] !== linkSegs[i]) { ok = false; break; }
    }
    if (ok) return true;
  }
  return false;
}

function findLinks(file) {
  const src = readFileSync(file, "utf8");
  const found = [];
  const patterns = [
    /\bbackTo=["'`](\/[^"'`${}]*)["'`]/g,
    /\bto=["'`](\/[^"'`${}]*)["'`]/g,
    /\bnavigate\(\s*["'`](\/[^"'`${}]*)["'`]/g,
    /\bnav\(\s*["'`](\/[^"'`${}]*)["'`]/g,
    /\bhref=["'`](\/[^"'`${}]*)["'`]/g,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(src))) {
      const path = m[1];
      // skip obvious externals / asset paths
      if (path.startsWith("//")) continue;
      if (/\.(png|jpg|svg|css|js|json|webp|ico)$/i.test(path)) continue;
      found.push({ path, file: relative(".", file) });
    }
  }
  return found;
}

const routes = loadRoutes();
const files = walk(SRC);
const links = files.flatMap(findLinks);

const dead = links.filter((l) => !pathMatchesRoute(l.path, routes));

if (dead.length === 0) {
  console.log(`✅ Route audit: ${links.length} links, all match a registered route.`);
  process.exit(0);
}

console.error(`❌ Route audit: ${dead.length} dead link(s) found:\n`);
const byPath = new Map();
for (const d of dead) {
  if (!byPath.has(d.path)) byPath.set(d.path, []);
  byPath.get(d.path).push(d.file);
}
for (const [path, where] of byPath) {
  console.error(`  ${path}`);
  for (const f of where) console.error(`     ↳ ${f}`);
}
process.exit(1);

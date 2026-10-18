import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { GUIDES } from "../src/guideContent.js";
import config from "../vercel.json" with { type: "json" };

const sitemap = await readFile(new URL("../dist/sitemap.xml", import.meta.url), "utf8");
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => new URL(match[1]));
assert.equal(new Set(urls.map(url => url.href)).size, urls.length, "Sitemap URLs must be unique");
for (const url of urls) {
  assert.equal(url.origin, "https://www.shotlink.in", "Use one canonical host");
  const file = url.pathname === "/" ? "index.html" : `${url.pathname.slice(1)}.html`;
  const html = await readFile(new URL(`../dist/${file}`, import.meta.url), "utf8");
  assert.ok(html.includes(`rel="canonical" href="${url.href}"`), `${file}: canonical must match sitemap`);
  assert.equal((html.match(/<h1(?:\s|>)/g) || []).length, 1, `${file}: one main heading`);
  assert.ok(/<title>[^<]+<\/title>/.test(html), `${file}: title required`);
  assert.ok(/name="description"\s+content="[^"]+"/.test(html), `${file}: description required`);
  if (url.pathname !== "/") {
    assert.ok(config.rewrites.some(rule => rule.source === url.pathname && rule.destination === `/${file}`), `${file}: public route required`);
  }
}
for (const guide of GUIDES) {
  const html = await readFile(new URL(`../dist/${guide.slug}.html`, import.meta.url), "utf8");
  assert.ok(html.includes(`<h1>${guide.title}</h1>`), `${guide.slug}: initial HTML must contain the guide`);
  assert.ok(html.includes(`rel="canonical" href="https://www.shotlink.in/${guide.slug}"`));
  assert.ok(sitemap.includes(`https://www.shotlink.in/${guide.slug}`));
  assert.ok(html.includes('href="/register"') && html.includes('href="/#create"'));
  assert.ok(!html.includes('/src/marketingEntry.js'), "Vite must bundle the analytics entry");
  assert.ok(!html.includes('name="robots" content="noindex'), "Public guides must be indexable");
}
console.log(`Verified ${urls.length} public pages and ${GUIDES.length} guides: content, metadata, canonicals, routes and conversion links.`);

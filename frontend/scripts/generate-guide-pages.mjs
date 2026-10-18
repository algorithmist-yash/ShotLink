import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { GUIDES } from "../src/guideContent.js";

const escape = (s) => String(s).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const links = GUIDES.map(g => `<a href="/${g.slug}">${escape(g.label)}</a>`).join("");
for (const guide of GUIDES) {
  const html = `<!doctype html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escape(guide.title)} | Shotlink</title><meta name="description" content="${escape(guide.description)}">
<link rel="canonical" href="https://www.shotlink.in/${guide.slug}"><meta name="robots" content="index,follow">
<meta property="og:title" content="${escape(guide.title)}"><meta property="og:description" content="${escape(guide.description)}"><meta property="og:url" content="https://www.shotlink.in/${guide.slug}"><meta property="og:type" content="article"><meta property="og:image" content="https://www.shotlink.in/og-creators.png"><meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/shotlink-symbol.png"><link rel="stylesheet" href="/guides.css"></head>
<body><a class="skip" href="#main">Skip to guide</a><header><a class="brand" href="/">shotlink<span>.in</span></a><nav aria-label="Primary"><a href="/#create">Create a link</a><a href="/pricing">Pricing</a><a href="/register">Free workspace</a></nav></header>
<main id="main"><p class="eyebrow">Shotlink guides / ${escape(guide.label)}</p><h1>${escape(guide.title)}</h1><p class="lead">${escape(guide.intro)}</p>
<div class="actions"><a class="button" href="/register">Create a free workspace →</a><a href="/#create">Try a temporary link</a></div>
<p class="note">Guest: up to 30 minutes. Workspace: up to 7 days. No payment details needed for Free.</p>
<section aria-labelledby="steps"><h2 id="steps">How to use it</h2><ol>${guide.steps.map(([title, text]) => `<li><h3>${escape(title)}</h3><p>${escape(text)}</p></li>`).join("")}</ol></section>
<aside><h2>A practical example</h2><p>${escape(guide.example)}</p></aside>
<section><h2>Before you share</h2><ul>${guide.limitations.map(t => `<li>${escape(t)}</li>`).join("")}</ul></section>
<section><h2>Common questions</h2>${guide.questions.map(([q,a]) => `<details><summary>${escape(q)}</summary><p>${escape(a)}</p></details>`).join("")}</section>
<nav class="related" aria-label="Related guides"><h2>More sharing guides</h2>${links}</nav></main>
<footer><a href="/">Shotlink</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/contact">Contact</a></footer><script type="module" src="/src/marketingEntry.js"></script></body></html>`;
  await writeFile(fileURLToPath(new URL(`../${guide.slug}.html`, import.meta.url)), html);
}
console.log(`Generated ${GUIDES.length} public sharing guides.`);

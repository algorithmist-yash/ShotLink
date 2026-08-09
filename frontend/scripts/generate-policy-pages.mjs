import { writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  LEGAL_PAGE_CONTENT,
  OPERATOR_NOTICE,
  POLICY_EFFECTIVE_DATE,
} from "../src/legalContent.js";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const frontendDirectory = resolve(scriptDirectory, "..");

const PAGES = [
  { id: "trust", file: "trust.html", path: "/trust" },
  { id: "terms", file: "terms.html", path: "/terms" },
  { id: "privacy", file: "privacy.html", path: "/privacy" },
  { id: "refund", file: "refund-policy.html", path: "/refund-policy" },
  { id: "delivery", file: "shipping-policy.html", path: "/shipping-policy" },
  { id: "contact", file: "contact.html", path: "/contact" },
];

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderLink(link) {
  return `<a href="${escapeHtml(link.href)}">${escapeHtml(link.label)}</a>`;
}

function renderSection(section) {
  const paragraphs = (section.paragraphs || [])
    .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
    .join("");
  const bullets = section.bullets?.length
    ? `<ul>${section.bullets.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
    : "";
  const links = section.links?.length
    ? `<div class="sl-static-links">${section.links.map(renderLink).join("")}</div>`
    : "";

  return `<article class="sl-static-card"><h2>${escapeHtml(section.title)}</h2>${paragraphs}${bullets}${links}</article>`;
}

function renderContactRows(rows = []) {
  if (!rows.length) return "";

  return `<dl class="sl-static-contact">${rows
    .map((row) => {
      const value = row.href
        ? `<a href="${escapeHtml(row.href)}">${escapeHtml(row.value)}</a>`
        : escapeHtml(row.value);
      return `<div><dt>${escapeHtml(row.label)}</dt><dd>${value}</dd></div>`;
    })
    .join("")}</dl>`;
}

function renderPage({ id, path }) {
  const policy = LEGAL_PAGE_CONTENT[id];
  const title = `${policy.eyebrow} | Shotlink`;
  const canonical = `https://shotlink.in${path}`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" type="image/png" href="/shotlink-symbol.png" />
    <link rel="canonical" href="${canonical}" />
    <meta name="description" content="${escapeHtml(policy.lead)}" />
    <meta name="robots" content="index, follow" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(policy.lead)}" />
    <meta property="og:url" content="${canonical}" />
    <meta property="og:type" content="website" />
    <meta property="og:image" content="https://shotlink.in/og.png" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(policy.lead)}" />
    <title>${escapeHtml(title)}</title>
    <style>
      body{margin:0;background:#f8fafc;color:#0f172a;font-family:"Plus Jakarta Sans",Inter,ui-sans-serif,system-ui,sans-serif}.sl-static-shell{width:min(980px,calc(100% - 40px));margin:auto;padding:0 0 80px}.sl-static-nav{display:flex;justify-content:space-between;align-items:center;gap:24px;min-height:76px;border-bottom:1px solid #e2e8f0}.sl-static-nav img{width:174px;height:auto}.sl-static-nav div,.sl-static-links{display:flex;gap:14px;flex-wrap:wrap}.sl-static-nav a,.sl-static-links a,.sl-static-contact a{color:#1d4ed8;font-weight:700;text-decoration:none}.sl-static-copy{padding:64px 0 28px}.sl-static-copy>p:first-child{color:#4338ca;font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}.sl-static-copy h1{margin:12px 0 18px;font-size:clamp(2.25rem,5vw,4rem);line-height:1.06;letter-spacing:-.04em}.sl-static-copy>p{max-width:760px;color:#475569;line-height:1.75}.sl-static-meta,.sl-static-card,.sl-static-contact>div{padding:24px;border:1px solid #e2e8f0;border-radius:14px;background:#fff}.sl-static-meta{display:grid;gap:8px;margin-bottom:18px;color:#475569;line-height:1.65}.sl-static-sections{display:grid;gap:16px}.sl-static-card h2{margin:0 0 12px;font-size:1.25rem}.sl-static-card p,.sl-static-card li{color:#475569;line-height:1.75}.sl-static-card ul{display:grid;gap:8px;padding-left:22px}.sl-static-contact{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px;margin:0 0 18px}.sl-static-contact dt{color:#64748b;font-size:12px;font-weight:800;text-transform:uppercase}.sl-static-contact dd{margin:8px 0 0;font-weight:700;overflow-wrap:anywhere}.sl-js-ready .sl-static-shell{display:none}@media(max-width:720px){.sl-static-nav div{display:none}.sl-static-copy{padding-top:40px}}
    </style>
  </head>
  <body>
    <main class="sl-static-shell">
      <nav class="sl-static-nav" aria-label="Primary navigation"><a href="/"><img src="/shotlink-logo.png" alt="Shotlink" width="440" height="108" /></a><div><a href="/pricing">Pricing</a><a href="/trust">Trust</a><a href="/contact">Contact</a></div></nav>
      <section class="sl-static-copy"><p>${escapeHtml(policy.eyebrow)}</p><h1>${escapeHtml(policy.title)}</h1><p>${escapeHtml(policy.lead)}</p></section>
      <div class="sl-static-meta"><strong>Effective ${escapeHtml(POLICY_EFFECTIVE_DATE)}</strong><span>${escapeHtml(OPERATOR_NOTICE)}</span></div>
${renderContactRows(policy.contactRows)}
      <section class="sl-static-sections">${policy.sections.map(renderSection).join("")}</section>
    </main>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
`;
}

await Promise.all(
  PAGES.map((page) =>
    writeFile(resolve(frontendDirectory, page.file), renderPage(page), "utf8")
  )
);

console.log(`Generated ${PAGES.length} indexable Shotlink policy pages.`);

import { useEffect, useState } from "react";

const PAGE_BY_PATH = Object.freeze({
  "/": "home",
  "/pricing": "pricing",
  "/docs": "docs",
  "/trust": "legal",
});

const PAGE_METADATA = Object.freeze({
  home: {
    title: "Shotlink | Branded short links and fallback routing",
    description: "Create measurable branded short URLs, QR codes, analytics, and health-aware fallback routes.",
    path: "/",
  },
  pricing: {
    title: "Shotlink Pricing | Plans for branded short links",
    description: "Compare Shotlink plans for short links, branded domains, QR codes, analytics, and campaign scale.",
    path: "/pricing",
  },
  docs: {
    title: "Shotlink Resources | Link and routing documentation",
    description: "Learn how to create Shotlinks, monitor analytics, connect domains, and operate fallback routing.",
    path: "/docs",
  },
  legal: {
    title: "Shotlink Trust | Privacy, security, and acceptable use",
    description: "Review Shotlink privacy, security, acceptable-use, analytics, and abuse-response principles.",
    path: "/trust",
  },
});

function getPublicPage() {
  const normalizedPath = window.location.pathname.replace(/\/$/, "") || "/";
  if (PAGE_BY_PATH[normalizedPath]) return PAGE_BY_PATH[normalizedPath];

  const legacyHash = String(window.location.hash || "").replace("#", "").trim().toLowerCase();
  return ["home", "pricing", "docs", "legal"].includes(legacyHash) ? legacyHash : "home";
}

function updateDocumentMetadata(pageId) {
  const metadata = PAGE_METADATA[pageId] || PAGE_METADATA.home;
  const canonicalUrl = `https://shotlink.in${metadata.path}`;
  document.title = metadata.title;

  for (const [selector, attribute, value] of [
    ["meta[name='description']", "content", metadata.description],
    ["meta[property='og:title']", "content", metadata.title],
    ["meta[property='og:description']", "content", metadata.description],
    ["meta[property='og:url']", "content", canonicalUrl],
    ["meta[name='twitter:title']", "content", metadata.title],
    ["meta[name='twitter:description']", "content", metadata.description],
    ["link[rel='canonical']", "href", canonicalUrl],
  ]) {
    document.querySelector(selector)?.setAttribute(attribute, value);
  }
}

export function usePublicPage() {
  const [publicPage, setPublicPage] = useState(getPublicPage);

  useEffect(() => {
    const update = () => setPublicPage(getPublicPage());
    window.addEventListener("popstate", update);
    window.addEventListener("hashchange", update);
    return () => {
      window.removeEventListener("popstate", update);
      window.removeEventListener("hashchange", update);
    };
  }, []);

  useEffect(() => updateDocumentMetadata(publicPage), [publicPage]);
  return [publicPage, setPublicPage];
}

export { getPublicPage, PAGE_METADATA, updateDocumentMetadata };

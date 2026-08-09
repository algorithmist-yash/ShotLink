import { useEffect, useState } from "react";

const PAGE_BY_PATH = Object.freeze({
  "/": "home",
  "/pricing": "pricing",
  "/docs": "docs",
  "/trust": "trust",
  "/terms": "terms",
  "/privacy": "privacy",
  "/refund-policy": "refund",
  "/cancellation-refund-policy": "refund",
  "/delivery-policy": "delivery",
  "/shipping-policy": "delivery",
  "/contact": "contact",
});

const PAGE_METADATA = Object.freeze({
  home: {
    title: "Shotlink | Short links and QR codes for content creators",
    description: "Create a temporary short link and QR code in seconds, or use Shotlink for permanent creator campaigns, branded domains, and audience analytics.",
    path: "/",
  },
  pricing: {
    title: "Shotlink Pricing | Plans for content creators",
    description: "Compare free, Creator Pro, and Studio plans for campaign links, QR codes, branded domains, and audience analytics.",
    path: "/pricing",
  },
  docs: {
    title: "Shotlink Resources | Link and routing documentation",
    description: "Learn how to create Shotlinks, monitor analytics, connect domains, and operate fallback routing.",
    path: "/docs",
  },
  trust: {
    title: "Shotlink Trust | Privacy, security, and acceptable use",
    description: "Review Shotlink privacy, security, acceptable-use, analytics, and abuse-response principles.",
    path: "/trust",
  },
  terms: {
    title: "Terms and Conditions | Shotlink",
    description: "Review the terms that apply to Shotlink links, workspaces, plans, billing, and acceptable use.",
    path: "/terms",
  },
  privacy: {
    title: "Privacy Policy | Shotlink",
    description: "Learn what information Shotlink processes, why it is used, when it is shared, and your choices.",
    path: "/privacy",
  },
  refund: {
    title: "Cancellation and Refund Policy | Shotlink",
    description: "Review how Shotlink subscription cancellations and eligible refund requests are handled.",
    path: "/refund-policy",
  },
  delivery: {
    title: "Digital Delivery and Shipping Policy | Shotlink",
    description: "Learn how Shotlink digital access is delivered and how to resolve an activation delay.",
    path: "/shipping-policy",
  },
  contact: {
    title: "Contact Us | Shotlink",
    description: "Contact Shotlink for creator account help, billing, privacy requests, partnerships, or abuse reports.",
    path: "/contact",
  },
});

function getPublicPage() {
  const normalizedPath = window.location.pathname.replace(/\/$/, "") || "/";
  if (PAGE_BY_PATH[normalizedPath]) return PAGE_BY_PATH[normalizedPath];

  const legacyHash = String(window.location.hash || "").replace("#", "").trim().toLowerCase();
  return PAGE_METADATA[legacyHash] ? legacyHash : "home";
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

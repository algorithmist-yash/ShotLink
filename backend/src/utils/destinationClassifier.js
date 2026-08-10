const VIDEO_FILE_PATTERN = /\.(mp4|mov|m4v|webm)(?:$|[?#])/i;

function classifyDestination(rawUrl) {
  try {
    const parsed = new URL(String(rawUrl || ""));
    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, "");
    const pathname = parsed.pathname.toLowerCase();

    if (hostname === "docs.google.com" && pathname.startsWith("/spreadsheets/")) {
      return { type: "google_sheet", provider: "google_sheets", label: "Google Sheet" };
    }

    if (
      hostname === "docs.google.com" &&
      (pathname.startsWith("/forms/") || pathname.startsWith("/forms/d/"))
    ) {
      return { type: "form", provider: "google_forms", label: "Google Form" };
    }

    if (
      (hostname === "docs.google.com" && pathname.startsWith("/document/")) ||
      hostname === "drive.google.com"
    ) {
      return { type: "document", provider: "google_drive", label: "Google document" };
    }

    if (hostname === "youtube.com" || hostname === "youtu.be") {
      return { type: "video", provider: "youtube", label: "YouTube video" };
    }

    if (hostname === "vimeo.com" || hostname.endsWith(".vimeo.com")) {
      return { type: "video", provider: "vimeo", label: "Vimeo video" };
    }

    if (hostname === "loom.com" || hostname.endsWith(".loom.com")) {
      return { type: "video", provider: "loom", label: "Loom video" };
    }

    if (VIDEO_FILE_PATTERN.test(parsed.href)) {
      return { type: "video", provider: "video_file", label: "Video file" };
    }

    if (
      ["instagram.com", "tiktok.com", "facebook.com", "x.com", "twitter.com", "linkedin.com"].includes(
        hostname
      )
    ) {
      return { type: "social", provider: hostname.split(".")[0], label: "Social post" };
    }

    return { type: "website", provider: hostname || "website", label: "Website" };
  } catch {
    return { type: "website", provider: "website", label: "Website" };
  }
}

module.exports = { classifyDestination };

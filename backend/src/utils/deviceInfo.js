const crypto = require("crypto");

function detectDeviceType(userAgent = "") {
  const value = userAgent.toLowerCase();

  if (!value) return "unknown";
  if (
    /bot|crawler|spider|slurp|curl|wget|uptimerobot|pingdom|headless|monitor/.test(value)
  ) {
    return "bot";
  }
  if (/ipad|tablet|kindle|playbook/.test(value)) {
    return "tablet";
  }
  if (/mobi|iphone|android/.test(value)) {
    return "mobile";
  }

  return "desktop";
}

function detectBrowser(userAgent = "") {
  const value = userAgent.toLowerCase();

  if (!value) return "Unknown";
  if (value.includes("edg/")) return "Edge";
  if (value.includes("opr/") || value.includes("opera")) return "Opera";
  if (value.includes("chrome/") && !value.includes("edg/")) return "Chrome";
  if (value.includes("firefox/")) return "Firefox";
  if (value.includes("safari/") && !value.includes("chrome/")) return "Safari";
  if (value.includes("curl/")) return "curl";

  return "Unknown";
}

function detectOs(userAgent = "") {
  const value = userAgent.toLowerCase();

  if (!value) return "Unknown";
  if (value.includes("windows")) return "Windows";
  if (value.includes("android")) return "Android";
  if (value.includes("iphone") || value.includes("ipad") || value.includes("ios")) {
    return "iOS";
  }
  if (value.includes("mac os") || value.includes("macintosh")) return "macOS";
  if (value.includes("cros")) return "ChromeOS";
  if (value.includes("linux")) return "Linux";

  return "Unknown";
}

function extractClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }

  return req.ip || req.socket?.remoteAddress || "";
}

function hashIp(ipAddress) {
  if (!ipAddress) return "";

  const salt = process.env.IP_HASH_SALT || "local-development-salt";

  return crypto.createHash("sha256").update(`${salt}:${ipAddress}`).digest("hex");
}

function buildClickContext(req) {
  const userAgent = req.get("user-agent") || "";

  return {
    clickedAt: new Date(),
    deviceType: detectDeviceType(userAgent),
    browser: detectBrowser(userAgent),
    os: detectOs(userAgent),
    userAgent,
    referrer: req.get("referer") || req.get("referrer") || "",
    ipHash: hashIp(extractClientIp(req)),
  };
}

module.exports = {
  buildClickContext,
  detectBrowser,
  detectDeviceType,
  detectOs,
  extractClientIp,
  hashIp,
};

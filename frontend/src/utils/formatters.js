export function formatPriceInInr(amountInPaise) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amountInPaise / 100);
}

export function formatPlanPrice(plan) {
  if (plan?.id === "enterprise") return "Custom";
  if (!plan?.priceInPaise) return "Free";
  const suffix = plan.intervalMonths === 1
    ? "/month"
    : plan.intervalMonths
      ? `/${plan.intervalMonths} months`
      : "";
  return `${formatPriceInInr(plan.priceInPaise)}${suffix}`;
}

export function formatUsageNumber(value) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(
    Number(value) || 0
  );
}

export function formatLabel(value) {
  return String(value || "")
    .split(/[_-\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function getUsageLabel(key) {
  const labels = {
    links: "Links",
    clicks: "Clicks",
    domains: "Domains",
    teamMembers: "Team members",
    apiRequests: "API requests",
    qrCodes: "QR codes",
  };
  return labels[key] || formatLabel(key);
}

export function formatDate(value) {
  if (!value) return "Not available yet";
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

const TONES = Object.freeze({
  healthy: { background: "rgba(16, 185, 129, 0.16)", color: "#bbf7d0" },
  warning: { background: "rgba(245, 158, 11, 0.18)", color: "#fde68a" },
  danger: { background: "rgba(239, 68, 68, 0.16)", color: "#fecaca" },
  neutral: { background: "rgba(255, 255, 255, 0.08)", color: "#f8fafc" },
  accent: { background: "rgba(37, 99, 235, 0.18)", color: "#dbeafe" },
});

export function StatusPill({ label, tone = "neutral" }) {
  const palette = TONES[tone] || TONES.neutral;
  return (
    <span className="sl-status-pill" data-tone={tone} style={{ background: palette.background, color: palette.color }}>
      {label}
    </span>
  );
}

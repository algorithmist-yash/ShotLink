import { formatUsageNumber, getUsageLabel } from "../utils/formatters";

export function DeviceBar({ item, total }) {
  const width = total ? `${Math.round((item.count / total) * 100)}%` : "0%";
  return (
    <div className="sl-device-bar">
      <div className="sl-metric-bar-header"><span className="sl-device-label">{item.deviceType}</span><span>{item.count}</span></div>
      <div className="sl-metric-bar-track"><div className="sl-device-bar-fill" style={{ width }} /></div>
    </div>
  );
}

export function UsageBar({ metric }) {
  if (!metric) return null;
  const tone = metric.percentUsed >= 90 ? "danger" : metric.percentUsed >= 70 ? "warning" : "normal";
  return (
    <div className="sl-usage-bar">
      <div className="sl-metric-bar-header"><span className="sl-usage-label">{getUsageLabel(metric.key)}</span><span className="sl-usage-count">{formatUsageNumber(metric.used)} / {formatUsageNumber(metric.limit)}</span></div>
      <div className="sl-metric-bar-track"><div className="sl-usage-bar-fill" data-tone={tone} style={{ width: `${metric.percentUsed || 0}%` }} /></div>
      <p className="sl-usage-remaining">{formatUsageNumber(metric.remaining)} remaining</p>
    </div>
  );
}

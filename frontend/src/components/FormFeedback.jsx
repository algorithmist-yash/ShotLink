export function ConsentCheckbox({ checked, onChange, children }) {
  return (
    <label className="sl-checkbox-row">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{children}</span>
    </label>
  );
}

export function FeedbackMessage({ message, tone = "error" }) {
  if (!message) return null;
  const isError = tone === "error";
  return (
    <p className="sl-feedback" data-tone={tone} role={isError ? "alert" : "status"} aria-live={isError ? "assertive" : "polite"}>
      {message}
    </p>
  );
}

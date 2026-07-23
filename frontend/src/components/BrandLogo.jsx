const BRAND_SYMBOL_SRC = "/shotlink-symbol.png";

export function BrandLogo({ compact = false, style }) {
  if (compact) {
    return <img className="sl-brand-symbol" src={BRAND_SYMBOL_SRC} alt="Shotlink" style={style} />;
  }

  return (
    <span className="sl-brand-lockup" aria-label="Shotlink" style={style}>
      <img src={BRAND_SYMBOL_SRC} alt="" aria-hidden="true" />
      <span className="sl-brand-wordmark">shotlink<span>.in</span></span>
    </span>
  );
}

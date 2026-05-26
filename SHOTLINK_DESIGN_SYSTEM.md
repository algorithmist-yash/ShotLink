# Shotlink Design System

Shotlink should feel like internet routing infrastructure: fast, exact, directional, and trusted. The visual system is derived from the logo: deep black surfaces, white route geometry, electric blue transmission accents, subtle cyan edge-light, hard contrast, and forward motion.

## Brand DNA

- Core metaphor: data packets moving through a precision route.
- Shape language: angled cuts, compact blocks, grid fields, thin directional lines.
- Lighting: dark base, white highlights, blue glow, cyan secondary edge-light.
- Motion: packets, route drift, staggered reveal, restrained hover lift.

## Color Tokens

| Token | Value | Use |
| --- | --- | --- |
| `sl-black` | `#03040a` | App background |
| `sl-night` | `#070914` | Deep panels |
| `sl-panel` | `rgba(8, 10, 22, 0.84)` | Cards and shells |
| `sl-white` | `#ffffff` | Hero text, active highlights |
| `sl-ice` | `#eef3ff` | Primary readable text |
| `sl-muted` | `#8e99b7` | Labels and secondary text |
| `sl-blue` | `#4c55ff` | Primary accent |
| `sl-blue-hot` | `#3038ff` | Pressed and route glow |
| `sl-cyan` | `#79e6ff` | Focus, edge signals, chart highlights |
| `sl-success` | `#8fffd2` | Healthy state |
| `sl-danger` | `#ff6b7a` | Risk and destructive state |

## Gradient Tokens

- Primary CTA: `linear-gradient(135deg, #ffffff 0%, #dfe5ff 34%, #4c55ff 100%)`
- Panel: `linear-gradient(150deg, rgba(12,15,31,.90), rgba(4,6,14,.86))`
- Active route: `linear-gradient(135deg, rgba(76,85,255,.22), rgba(3,4,10,.82))`
- Chart bars: `linear-gradient(180deg, #ffffff 0%, #4c55ff 52%, #151cff 100%)`

## Typography

- Preferred stack: `Inter Tight`, `Inter`, system UI, `Segoe UI`.
- Hero: very tight tracking, high contrast, compact line height.
- Labels: uppercase, wide tracking, strong weight.
- Body: 1.55 to 1.7 line height for readability.

## Component System

- Buttons: luminous primary gradient, dark secondary, 16px radius, hover lift.
- Cards: dark layered panel, thin blue-white border, subtle inner highlight.
- Inputs: black translucent fill, blue/cyan focus ring, compact radius.
- Badges: uppercase, pill-shaped, token-based status colors.
- Charts: blue-white gradients, rounded bars, glow without cyberpunk excess.
- Navigation: capsule shell, active route highlight, subtle glass blur.

## Motion Strategy

- Page reveal: short upward fade.
- Hover: small lift only, no jumpy motion.
- Background: slow glow drift.
- Routing visual: packet movement across line segments.
- Accessibility: all motion is disabled through `prefers-reduced-motion`.

## Tailwind Token Draft

```js
theme: {
  extend: {
    colors: {
      sl: {
        black: "#03040a",
        night: "#070914",
        white: "#ffffff",
        ice: "#eef3ff",
        muted: "#8e99b7",
        blue: "#4c55ff",
        blueHot: "#3038ff",
        cyan: "#79e6ff",
        success: "#8fffd2",
        danger: "#ff6b7a",
      },
    },
    boxShadow: {
      "sl-glow": "0 0 42px rgba(76, 85, 255, 0.28)",
      "sl-panel": "0 30px 100px rgba(0, 0, 0, 0.42)",
    },
    borderRadius: {
      sl: "1.5rem",
      "sl-lg": "2rem",
    },
  },
}
```

## Product UI Direction

- Landing: concise infrastructure positioning, animated route visual, metric strip, product cards, analytics preview, API block, trust pills.
- Dashboard: command-center header, status strip, high-contrast panels, route-focused cards, premium input and table surfaces.
- Future pages: docs, pricing, billing, domains, API keys, abuse, and admin should reuse the same panel, badge, and focus systems.

## Enterprise Readiness Checklist

- Keep all CTAs and active states blue-white, never random gradients.
- Use green only for health, red only for risk, yellow only for warnings.
- Every new feature card should contain a signal label, concise title, and one operational benefit.
- Every data surface should include a state label, last updated or scope hint, and clear empty state.
- Avoid playful illustrations. Use network grids, route lines, terminal blocks, charts, and status lights.

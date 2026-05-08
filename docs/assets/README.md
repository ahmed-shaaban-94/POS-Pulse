# POS Pulse Visual Assets

This directory contains GitHub-renderable SVG assets used by the POS Pulse
README and documentation.

## Files

| Path | Purpose |
| --- | --- |
| `hero-pos-pulse.svg` | Primary README hero for the POS terminal story. |
| `architecture-terminal.svg` | Isometric architecture visual for the Electron terminal. |
| `icons/*.svg` | Small reusable icons for platform capabilities and terminal subsystems. |

## Style

- Use restrained enterprise SaaS colors: deep navy, slate, blue, teal, amber,
  and white.
- Keep visuals terminal-focused: cashier workflow, Electron boundary, local
  durability, hardware, and audit safety.
- Include `title` and `desc` elements in SVGs for accessibility.
- Avoid raster diagrams so documentation remains lightweight and reviewable.

## Naming

- Use lowercase kebab-case.
- Use capability names for icons, for example `operator-session.svg`.
- Add new assets only when they support a documented section or diagram.

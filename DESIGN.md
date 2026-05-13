---
name: POS-Pulse
description: Professional pharmacy POS terminal — precise, accountable, unhurried.
colors:
  primary: "#1f4e7a"
  primary-emphasis: "#163d61"
  primary-soft: "#e6eef6"
  primary-on: "#ffffff"
  accent: "#2e7da3"
  rail: "#0e1b2a"
  rail-hover: "#162a40"
  rail-text: "#cdd6e0"
  rail-text-dim: "#7a8a9c"
  background: "#fbfcfd"
  surface: "#ffffff"
  surface-elevated: "#f3f6fa"
  surface-sunken: "#eef2f6"
  text: "#0f1d2e"
  text-muted: "#5b6b7c"
  text-inverse: "#ffffff"
  border: "#d8dfe7"
  border-soft: "#e7ecf2"
  border-strong: "#9ca3af"
  success: "#1f8a5b"
  success-emphasis: "#176944"
  success-soft: "#e7f5ee"
  warning: "#b87600"
  warning-emphasis: "#8f5b00"
  warning-soft: "#fbf0db"
  danger: "#b32e36"
  danger-emphasis: "#8e2329"
  danger-soft: "#f7e2e3"
  info: "#1e6f8c"
  info-emphasis: "#175670"
  info-soft: "#e1f0f5"
  neutral: "#5b6b7c"
  neutral-emphasis: "#3d4c5a"
typography:
  display:
    fontFamily: "'Inter Variable', Inter, 'Segoe UI', system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "'Inter Variable', Inter, 'Segoe UI', system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.008em"
  title:
    fontFamily: "'Inter Variable', Inter, 'Segoe UI', system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.005em"
  body:
    fontFamily: "'Inter Variable', Inter, 'Segoe UI', system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0"
  label:
    fontFamily: "'Inter Variable', Inter, 'Segoe UI', system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.01em"
  mono:
    fontFamily: "ui-monospace, 'Cascadia Code', 'JetBrains Mono', monospace"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  none: "0"
  sm: "2px"
  md: "4px"
  lg: "8px"
  control: "10px"
  card: "14px"
  pane: "16px"
  pill: "9999px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "5": "24px"
  "6": "32px"
  "7": "48px"
  "8": "64px"
  "9": "96px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-on}"
    rounded: "{rounded.control}"
    padding: "0 14px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.primary-emphasis}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "0 14px"
    height: "44px"
  button-secondary-hover:
    textColor: "{colors.primary}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "0 14px"
    height: "44px"
  button-ghost-hover:
    backgroundColor: "{colors.surface-elevated}"
  button-destructive:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.primary-on}"
    rounded: "{rounded.control}"
    padding: "0 14px"
    height: "44px"
  button-destructive-hover:
    backgroundColor: "{colors.danger-emphasis}"
  nav-entry:
    backgroundColor: "transparent"
    textColor: "{colors.rail-text}"
    rounded: "12px"
    height: "48px"
  nav-entry-active:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-on}"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.card}"
    padding: "{spacing.6}"
---

# Design System: POS-Pulse

## 1. Overview

**Creative North Star: "The Accountable Instrument"**

POS-Pulse is a precision instrument, not a consumer product. Its visual language is calibrated around one question: does the operator know the true state of every operation? The interface is built from clean white surfaces, a commanding navy command rail, and a restrained accent vocabulary that preserves the visual weight of information. Every interaction is keyboard-first; every state change is legible without mouse proximity. The palette is determinedly light — pharmacy floor environments require opaque, well-lit surfaces that read under overhead fluorescent lighting, not atmospheric depth.

The system is Arabic-first: RTL layout is the default, and the font stack gracefully degrades from Inter Variable to Segoe UI to system-UI without introducing a proprietary dependency that could cause a visual regression on a paired Windows 10 terminal. Motion is state-change-only: transitions confirm actions, they do not entertain.

The design explicitly rejects consumer SaaS aesthetics, glassmorphism, dark-mode defaults, SaaS metric-hero templates, and generic AI tool aesthetics. If a screen could be mistaken for a Notion dashboard or a startup landing page, something has gone wrong.

**Key Characteristics:**
- Restrained color strategy: navy primary + teal accent occupy less than 15% of any screen; the rest is neutral surface
- Flat-by-default with structural shadow for elevation hierarchy (cards lift gently; overlays are unmistakably above)
- Inter Variable as the single sans typeface; no secondary display font; weight contrast carries hierarchy
- All interactive elements meet the 44 × 44 CSS px touch-target floor
- State banners (status, warnings, errors) are persistent, not toast-based
- The dark navigation rail is the one intentionally drenched surface; it anchors the layout without darkening the workspace

## 2. Colors: The Command Palette

A restrained palette built around a single navy primary with a teal accent marker. Neutrals are tinted toward the primary hue at chroma 0.005–0.01 so they never read as cold gray.

**The One-Accent Rule.** The teal accent (`#2e7da3`) appears only as a navigational marker (the active-state tab on the rail entry) and a focus-ring fallback. It is not used as a button color, badge color, or decorative fill. Its rarity is the point.

### Primary
- **Command Navy** (`#1f4e7a`): Primary action buttons, active navigation entries, key interactive affordances. The authority color — use where commitment is being requested.
- **Deep Command** (`#163d61`): Hover and emphasis state for primary elements. 3–5% darker than Command Navy.
- **Horizon Wash** (`#e6eef6`): Soft background tint for selected states, info surfaces, and tag fills. Never used for full-panel backgrounds.

### Secondary
- **Teal Marker** (`#2e7da3`): Navigation active-state accent tab (4 × 24 px rule only), focus rings as the Clerk accent color. Never a fill.

### Neutral
- **Midnight Ink** (`#0f1d2e`): Primary text. The darkest color in the system; never pure black.
- **Muted Slate** (`#5b6b7c`): Secondary text, descriptions, placeholder copy. Readable at 14px minimum.
- **Near-White** (`#fbfcfd`): Workspace background. Slightly warm; never pure white.
- **Clean White** (`#ffffff`): Card and panel surfaces that lift off the workspace.
- **Lifted Canvas** (`#f3f6fa`): Inert tiles, slot-ID chips, banner band backgrounds.
- **Recessed** (`#eef2f6`): Sunken well — PIN keypad recess, inset panels. Reads as below surface.
- **Quiet Edge** (`#d8dfe7`): Default border. Separates without competing.
- **Whisper Edge** (`#e7ecf2`): Soft divider, subtler than Quiet Edge.
- **Vault Dark** (`#0e1b2a`): Navigation rail background. The one intentionally dark surface in the system.
- **Muted Silver** (`#cdd6e0`): Rail text at rest. Readable on Vault Dark; visually recessive when not hovered.

### Status Colors
- **Confirmation Green** (`#1f8a5b` / soft `#e7f5ee`): Success states — sale confirmed, shift opened.
- **Caution Amber** (`#b87600` / soft `#fbf0db`): Warnings — degraded connection, low stock, near-expiry.
- **Alert Red** (`#b32e36` / soft `#f7e2e3`): Destructive states, errors, offline banners. Used for danger buttons.
- **Info Teal** (`#1e6f8c` / soft `#e1f0f5`): Syncing state, informational banners.

**The Status-Color Containment Rule.** Status colors (success, warning, danger, info) appear only on their designated surfaces (badges, status banners, alert callouts). They are never used as decorative fills, hover accents, or brand colors on primary actions.

## 3. Typography

**Primary Font:** Inter Variable → Inter → Segoe UI → system-UI → sans-serif
**Mono Font:** ui-monospace → Cascadia Code → JetBrains Mono → monospace

**Character:** A single humanist sans that scales from receipt-line labels at 11px to display headings at 30px without needing a companion face. Weight is the hierarchy lever: bold (700) for display and headline, semibold (600) for titles and labels, regular (400) for body. No italic emphasis in the core UI — bold is preferred for in-line emphasis in operational text.

**The No-Second-Font Rule.** Inter Tight and any secondary display typeface are rejected by spec (FR-052). Weight contrast alone carries the display hierarchy. A secondary proprietary font would introduce a Windows font dependency that causes fallback regressions on paired terminals.

### Hierarchy
- **Display** (700, 30px / 1.875rem, line-height 1.1, letter-spacing −0.01em): Screen titles, modal headings. Used sparingly — at most one per screen.
- **Headline** (700, 24px / 1.5rem, line-height 1.2, letter-spacing −0.008em): Section headers, panel titles within a screen.
- **Title** (600, 18px / 1.125rem, line-height 1.3, letter-spacing −0.005em): Card headers, form section labels, named regions.
- **Body** (400, 16px / 1rem, line-height 1.5): Primary paragraph text. Cap line length at 65–75ch on reading surfaces.
- **Label** (600, 12px / 0.75rem, line-height 1, letter-spacing +0.01em): Badges, chip labels, table column headers, status indicators.
- **Mono** (400, 14px / 0.875rem, line-height 1.5): Terminal IDs, receipt line amounts, barcode values, audit reference strings.

**The Tight-Display Rule.** Display and Headline headings use letter-spacing −0.01em and −0.008em respectively — not Inter Tight as a separate face. The visual effect is equivalent; the font stack remains a single family.

## 4. Elevation

The system uses structural shadows — subtle, ambient, tinted toward the primary navy hue rather than flat black. The layering model has four distinct levels: workspace, surface, elevated, and overlay. Elevation is never decorative; it maps directly to z-index and interaction scope.

**The Flat-By-Default Rule.** Every surface starts flat. Shadows appear only as a structural response to layering (card above workspace, dialog above everything) or to state (hover on a card signals lift). Purely decorative shadows are prohibited.

### Shadow Vocabulary
- **None** (`box-shadow: none`): Default state for all surfaces; no resting shadow on interactive elements.
- **sm** (`0 1px 2px rgba(0,0,0,0.05)`): Hairline depth for inline chips, tight status indicators.
- **card** (`0 1px 2px rgba(15,29,46,0.04), 0 8px 24px rgba(15,29,46,0.06)`): Standard card elevation. The tint toward `#0f1d2e` (Midnight Ink) keeps it cool rather than generic gray.
- **pane** (`0 18px 60px rgba(15,29,46,0.10)`): Modal-adjacent panels, the pairing screen pane.
- **overlay** (`0 20px 25px -5px rgba(0,0,0,0.25), 0 8px 10px -6px rgba(0,0,0,0.25)`): Dialogs and drawers. Unmistakably above the page.
- **inset** (`inset 0 1px 0 rgba(15,29,46,0.04), inset 0 0 0 1px rgba(15,29,46,0.04)`): Sunken wells — the PIN keypad recess, numeric input backgrounds where depth is needed.

## 5. Components

### Buttons
Buttons are the primary commitment affordances. Their shape is gently rounded (10px radius, `--radius-control`) — more deliberate than pill, less austere than square. All buttons are 44px minimum height to meet the touch-target floor.

- **Primary** (Command Navy fill, white text, 10px radius, 14px inline padding): For the single most important action on a surface — confirm sale, sign in, apply. One primary button per context.
- **Primary hover/focus**: Darkens to Deep Command (`#163d61`). Focus ring: 4px, 18%-opacity Command Navy halo.
- **Secondary** (white surface, Quiet Edge border, Midnight Ink text): Supporting actions alongside a primary. On hover, border shifts to 50%-opacity primary; text shifts to Command Navy. Signals readiness without competing.
- **Ghost** (transparent fill, Midnight Ink text): Low-commitment actions, navigation triggers, cancel. On hover, fills with Lifted Canvas.
- **Destructive** (Alert Red fill, white text): Permanent or financial-consequence actions — void, delete, force-close. Hover darkens to Deep Red (`#8e2329`). Focus ring: 4px, 18%-opacity Alert Red halo.
- **Disabled/Loading**: 50% opacity, `cursor: not-allowed`. Loading shows a CSS spinner at the button's leading edge; label remains visible.

**The Single Primary Rule.** No screen or modal shall have more than one primary-intent button visible at once. When two confirmations are needed, sequence them.

### Navigation Rail
The navigation rail is the visual anchor of the application shell — the one intentionally dark surface (Vault Dark, `#0e1b2a`). It collapses to 84px icon-only below 1280px; expands to 248px with labels at 1280px+; hidden below 1024px.

- **Entry** (48px height, 44px min-height, 12px radius, Muted Silver text at rest): Keyboard and pointer navigable. Focus ring is Teal Marker, 2px outline offset 2px.
- **Entry hover** (Vault Dark hover `#162a40` fill, white text): Subtle lift within the dark rail.
- **Active entry** (Command Navy fill, white text, 4×24px Teal Marker accent tab on inset-start edge): The accent tab is the only use of teal as a fill; it marks current location unambiguously without color alone.

### Cards
Cards are used for bounded content regions — pairing flows, operator panels, form sections. Not for data lists.

- **Default card** (white surface, 1px Quiet Edge border, 14px radius, card shadow, 32px padding): Standard contained region.
- **Muted card** (Lifted Canvas background, no shadow): Inert or secondary content regions, e.g. metadata tiles.
- **Elevated card** (pane shadow): Prominent single-action panels, e.g. the pairing screen pane.

**The No-Nested-Cards Rule.** Cards do not contain cards. If content inside a card needs grouping, use spacing, borders, or background color shifts — never a child card component.

### Inputs
Inputs use the same radius as buttons (10px, `--radius-control`) for visual family membership. The 44px minimum height is enforced globally via the base element rule.

- **Default** (white background, 1px Quiet Edge border, 14px font-size, 8px vertical padding): Clean and unadorned; the border is the only structure.
- **Focus** (Command Navy border, 3px primary halo at 20% opacity, outline suppressed): Focus is unmistakable; the halo avoids the common 1px-only underline that fails under glare.
- **Error** (Alert Red border; on focus, Alert Red halo at 20%): Error state preserves focus behavior; the border color change is reinforced by the halo and the error message below.
- **Disabled** (inherits opacity from button disabled rule): Input text and label dim together.

### Status Banners
Status banners are the system's primary ambient-state affordance. They run full-width under the top bar and remain persistent until the underlying condition resolves. They are never auto-dismissing.

- **Degraded** (Caution Amber soft background `#fbf0db`, amber border, amber text): Network degradation, hardware fault.
- **Offline** (Alert Red soft background `#f7e2e3`, red border, red text): Terminal is offline; selling from local queue.
- **Syncing** (Info Teal soft background `#e1f0f5`, teal border, teal text, animated pulse dot): Background sync in progress.
- **None** (hidden): No state banner is shown when the terminal is fully online.

**The Persistent Banner Rule.** Status banners are never toasts. If a hardware or connectivity condition requires the operator's attention, the banner stays until the condition resolves. Ephemeral toasts are reserved for transient acknowledgement of user-initiated actions (sale saved, receipt printed).

### Badges
Badges are pill-shaped inline labels (26px height, 8px inline padding, pill radius, 12px semibold text) used for status attribution — shift state, connection state, operator role. They include an 8px color dot as a secondary signal alongside the text label.

- Intent variants: info (teal soft), success (green soft), warning (amber soft), danger (red soft), neutral (neutral soft).

## 6. Do's and Don'ts

### Do:
- **Do** use Command Navy (`#1f4e7a`) as the single primary action color. One primary per context.
- **Do** keep the workspace background Near-White (`#fbfcfd`), never pure white. Tinted neutrals prevent the terminal from reading as a blank canvas.
- **Do** use status banners (full-width, persistent) for ambient operational state. Reserve toasts for ephemeral confirmations of user-initiated actions.
- **Do** surface the true state of every operation — failed receipt, degraded connection, offline queue — with a visible, non-dismissable indicator.
- **Do** meet the 44 × 44 CSS px touch-target floor on every interactive element. The cashier uses a touchscreen; tiny buttons cost seconds per transaction.
- **Do** accompany every color-coded state (badge, status banner) with an icon or text label. Color alone is not a state signal.
- **Do** use negative letter-spacing on headings (−0.01em for display, −0.008em for headline) to achieve display density — not Inter Tight or a secondary font.
- **Do** apply `--shadow-card` to standard cards and `--shadow-overlay` to dialogs. The shadow vocabulary has specific roles; do not mix levels.
- **Do** use the inset shadow (`--shadow-inset`) for sunken well surfaces — PIN keypad recesses, numeric input backgrounds where tactile depth is needed.
- **Do** keep the navigation rail as the only intentionally dark surface. The workspace is light; the rail grounds it.

### Don't:
- **Don't** use consumer SaaS aesthetics (Notion, Intercom, Loom gradient heroes). The interface is a terminal, not a product landing page.
- **Don't** use glassmorphism or backdrop-blur decoratively. Surfaces must be opaque and legible under pharmacy overhead lighting.
- **Don't** apply dark mode by default. The one light theme is deliberate for the pharmacy floor environment; dark mode is out of scope until explicitly reopened by a product decision.
- **Don't** build SaaS metric-hero templates (big number, gradient accent, shadow flourish). Every number on screen carries financial weight; no cosmetic framing.
- **Don't** use identical icon-heading-text card grids. Prefer functional lists, tabular data, and purpose-built surfaces.
- **Don't** use gradient text (`background-clip: text`). It is decorative, never meaningful in a financial terminal.
- **Don't** use `border-left` or `border-right` greater than 1px as a colored accent stripe on cards, list items, or callouts. Rewrite with full borders, background tints, or leading icons.
- **Don't** use the Teal Marker accent (`#2e7da3`) as a button fill, badge color, or decorative accent. It is reserved for the nav active-state tab and focus rings only.
- **Don't** use status colors (success green, caution amber, alert red, info teal) as brand or decorative fills. They carry operational meaning; misuse degrades the operator's ability to read state at a glance.
- **Don't** use auto-dismissing toasts for operational state (offline, degraded, hardware fault). Those require persistent banners.
- **Don't** apply modal dialogs as a first-resort pattern. Exhaust inline and progressive disclosure alternatives. Modals are for high-stakes confirmations (void, forced close, destructive actions) only.
- **Don't** nest cards. If content inside a card needs grouping, use spacing, borders, or background tints.
- **Don't** use generic AI-tool aesthetics (purple gradients, neon-on-dark, glassmorphism-as-brand). This is a regulated commercial terminal.

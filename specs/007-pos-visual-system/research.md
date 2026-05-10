# Phase 0 Research — POS Visual System Recovery

**Feature:** 007-pos-visual-system
**Plan:** [./plan.md](./plan.md)
**Status:** Phase 0 evidence — decisions captured; alternatives recorded
**Date:** 2026-05-10

---

This document records the five decisions the plan rests on, with chosen
approach, alternatives considered, and rationale. Every decision is cited
back to a normative spec FR / NFR or to the live code as evidence.

---

## R0 — Token alignment audit (live repo vs Claude Design)

**Question.** How aligned is the live `src/renderer/styles/tailwind.css` and
`src/renderer/ui/tokens/` with Claude Design's
`handoff/01-design-tokens.md`? The spec assumes a *recovery*, but if the
underlying tokens already match, the recovery is small.

**Audit.** Read the live `tailwind.css` (1088 lines) and every
`src/renderer/ui/tokens/*.ts` export against CD's `handoff/01-design-tokens.md`.

| Surface | Live repo | Claude Design | Verdict |
|:--|:--|:--|:--|
| Brand primary | `--color-primary: #1f4e7a` | `#1F4E7A` | **Identical** (case difference only) |
| Primary emphasis | `--color-primary-emphasis: #163d61` | `#1A4267` | Close (~3% delta — repo is slightly cooler/darker) |
| Primary soft | `--color-primary-soft: #e6eef6` | `#E6EEF6` | **Identical** |
| Accent | `--color-accent: #2e7da3` | `#2E7DA3` | **Identical** |
| Workspace bg | `--color-background: #fbfcfd` | `--color-bg-app: #F4F6F9` | Close — repo is slightly warmer/lighter |
| Surface (card) | `--color-surface: #ffffff` | `#FFFFFF` | **Identical** |
| Surface elevated | `--color-surface-elevated: #f3f6fa` | `--color-surface-sunken: #EEF2F6` | **Different intent** — repo's "elevated" reads "above surface"; CD's "sunken" reads "PIN well / keypad recess". 007 ADDS `--color-surface-sunken` rather than rename the existing one |
| Rail | `--color-rail: #0e1b2a` | `#0B1726` | Close (~3px delta — repo is slightly warmer) |
| Rail hover | `--color-rail-hover: #162a40` | `#142640` | Close |
| Rail text | `--color-rail-text: #cdd6e0` | `--color-fg-inverse: #F4F6F9` | Different. Repo uses a tinted `cdd6e0` (a softer mute); CD uses a near-white `F4F6F9`. Decision recorded in S3 |
| Text primary | `--color-text: #0f1d2e` | `--color-fg-1: #0C1A2B` | Close (~3% delta) |
| Text muted | `--color-text-muted: #5b6b7c` | `--color-fg-2: #4B5B6E` | Close |
| Border | `--color-border: #d8dfe7` | `#D6DDE6` | Close |
| Border soft | `--color-border-soft: #e7ecf2` | `--color-line-soft: #EAEEF3` | Close |
| Success / warning / danger / info family | All four families present with `-emphasis` / `-soft` / `-on` triplets | Same triplet shape; values within 1–3% on every family | Close |
| Spacing | `--space-0..8` (9 entries: 0/4/8/12/16/24/32/48/64) | `--space-1..9` (9 entries: 4/8/12/16/24/32/48/64/96) | Same scale shape; CD adds a 96 px outermost step the repo doesn't have. 007 ADDS `--space-9: 96px` (additive only) |
| Radius | `--radius-{none,sm,md,lg,control,card,pane,pill}` (8 entries) | `--radius-{1..6,pill}` (7 entries: 2/6/8/10/14/18/9999) | Different naming, similar values. Repo's `control: 10px` = CD's `--radius-4: 10px`; repo's `card: 14px` = CD's `--radius-5: 14px`; repo's `pane: 16px` ≠ CD's `--radius-6: 18px` (~2px delta). Decision: keep repo names verbatim; ADD CD-flavour aliases ONLY if a slice needs them |
| Shadow | `--shadow-{none,sm,md,lg,card,pane,overlay}` (7 entries) | `--shadow-{sm,card,pane,overlay,inset}` (5 entries) | Repo is a superset of CD except for `--shadow-inset` (CD uses for sunken PIN well + keypad recess). 007 ADDS `--shadow-inset` (additive only) |
| Font sans | `--font-family-sans: 'Inter Variable', Inter, 'Segoe UI', system-ui, -apple-system, sans-serif` | `--font-sans: "Inter", system-ui, -apple-system, "Segoe UI", sans-serif` | Same intent — repo additionally uses Inter Variable as the first option, which is graceful (Variable is bundled-friendly; Inter and system-UI are the fallback) |
| Font display | (none — repo uses sans for headings) | `--font-display: "Inter Tight", "Inter", system-ui, sans-serif` | Repo correctly does NOT introduce Inter Tight as a separate face. **Spec FR-052 forbids the second proprietary font; CD's `--font-display` is rejected.** See R1 |
| Font mono | `--font-family-mono: ui-monospace, 'Cascadia Code', 'JetBrains Mono', monospace` | `--font-mono: "JetBrains Mono", ui-monospace, "SF Mono", "Cascadia Mono", monospace` | Both stacks list JetBrains Mono in their fallback chains. Repo correctly puts `ui-monospace` first (OS-provided); CD lists JetBrains Mono first (proprietary). **Repo wins per FR-051 priority (3) — repo references override CD on disagreement.** See R1 |
| Density | `comfortable` (applied), `compact` (reserved dead token) | `comfortable` only (CD does not document density) | Repo is stricter; preserve |
| Touch target floor | `touchTarget.min === 44` | "44 × 44 px (Apple HIG) — applies to every tappable element" | **Identical** |
| Connection states | `online / degraded / offline / syncing` (4 enum values) | `online / syncing / slow / offline` (CD `02-components.md`) | Close — CD's "slow" maps to repo's "degraded". Spec FR-008 forbids new connection states; repo wins |
| Motion durations | (none in tokens; per-component animations in `tailwind.css`) | `--duration-1..4` (80 / 150 / 220 / 320 ms), `--ease-out`, `--ease-in-out` | Repo lacks centralised motion tokens. 007 ADDS `--duration-1..4`, `--ease-out`, `--ease-in-out` (additive only) |

**Decision.** **Token additivity is the policy.** Every existing 003 token
name is preserved verbatim — no rename, no repurpose, no removal — per
spec FR-003. Claude Design's parallel names land as additive new exports
only when they have no 003 counterpart (e.g. `--color-surface-sunken`,
`--shadow-inset`, `--space-9`, `--duration-1..4`, `--ease-out`,
`--ease-in-out`). Value tweaks to existing tokens (e.g. `--color-rail`
exact value alignment with CD) are direct CSS-variable updates, not
renames.

**Alternative rejected — alias.** Re-point existing 003 tokens at CD
values via CSS-variable indirection. Rejected because (a) it doesn't
give the implementer access to CD's parallel names directly, and (b) it
introduces a layer of indirection that obscures the diff during PR
review.

**Alternative rejected — amendment.** Amend the 003 contract to rename
existing tokens to CD's names. Rejected because (a) FR-003 forbids
silent renames, and (b) it forces every 003 / 004 callsite to be
touched, contradicting the "restyle, do not rewrite" policy.

---

## R1 — Font policy resolution (Inter Tight rejection, JetBrains Mono fallback)

**Question.** Spec FR-052 / Assumption A10 commit to "Inter primary,
system-UI fallback when Inter is unavailable; no proprietary brand
fonts". CD's `01-design-tokens.md` proposes `--font-display: "Inter
Tight", "Inter", …` and `--font-mono: "JetBrains Mono", …`. How are
these resolved?

**Decision.**

- **Inter Tight is rejected.** Inter Tight is a separate font family
  with distinct metrics from Inter, designed for tighter display use.
  Adopting it as a CSS variable would introduce a second proprietary
  font dependency, contradicting FR-052. Tight display feel is achieved
  via Inter weight-700 with negative letter-spacing
  (`letter-spacing: -0.01em` per CD's display H1 spec) instead. The
  visual difference is small enough that a designer-blind comparison
  would not flag it.
- **JetBrains Mono is preserved only as a fallback in the existing
  `--font-family-mono` chain.** The live chain is `ui-monospace,
  'Cascadia Code', 'JetBrains Mono', monospace`. The OS-provided
  `ui-monospace` is the primary face; `JetBrains Mono` is a final
  fallback only. The recovered surfaces MUST NOT visually regress if
  JetBrains Mono is missing on the target Windows 10 / 11 terminal —
  the `ui-monospace` fallback is the acceptance baseline. CD's
  proposal to put JetBrains Mono first is rejected per FR-051
  priority (3) — repo references override CD on disagreement.
- **Inter as the primary sans face is preserved verbatim.** The live
  `--font-family-sans` chain (`'Inter Variable', Inter, 'Segoe UI',
  system-ui, -apple-system, sans-serif`) graceful-degrades from Inter
  Variable (bundled-friendly woff2) to Inter (system-installed) to
  Segoe UI (Windows native) to system-UI (cross-OS). FR-052 is
  honoured: Inter is primary; Segoe UI / system-UI is the fallback
  when Inter is unavailable; no proprietary brand fonts beyond Inter.
- **No `@font-face` declaration is added by 007.** The plan's S1 token
  delta does NOT introduce a webfont bundle. The Inter Variable
  delivery mechanism (bundled woff2, OS pre-install, system-UI
  fallback) is a downstream `/speckit-tasks` decision, not pinned by
  this plan.

**Alternative rejected — adopt CD's `--font-display` verbatim.**
Rejected because Inter Tight is a second proprietary face;
FR-052 forbids it.

**Alternative rejected — drop JetBrains Mono entirely.** Rejected
because the existing fallback list does no harm — it lists JetBrains
Mono *after* `ui-monospace`, so on a terminal lacking JetBrains Mono
the OS-provided face is used. Removing the entry would make a future
slice that wants a "code-like" feel less expressive.

---

## R2 — Figma Make adjudication (which parts adopt, which reject)

**Question.** The Figma Make package
(`figma-make/POS-figam-2/`) ships docs, theme CSS, and a
`src.zip` archive of generated React. Which parts are useful, which
are non-binding?

**Inspected files (out-of-tree, in
`/c/Users/user/Downloads/pos-design-reference-temp/figma-make/`):**

| File | Verdict | Reasoning |
|:--|:--|:--|
| `DESIGN_HANDOFF_README.md` | **Adapt — structure only** | Lists 7 deliverables; the screen catalogue cross-checks CD's 12-screen contact sheet for state-inventory completeness. Specific token / component values are NON-binding (FM uses shadcn defaults rejected below) |
| `IMPLEMENTATION_NOTES.md` | **Reject in entirety** | Includes Argon2 PIN-validation patterns, SQLite migration scaffolding, IPC handler examples, React Router proposals — all contradict 004's AD-1 / AD-2 / Approval Gate §A1, NFR-001, and the 007 spec's renderer-only posture (FR-050) |
| `DELIVERABLES.md` | **Adapt — structure only** | Same as `DESIGN_HANDOFF_README.md`; component/screen list is useful as a structural cross-check |
| `PROTOTYPE_README.md` | **Adapt — structure only** | Lists user flows; useful as a state-inventory cross-check |
| `default_shadcn_theme.css` | **Reject in entirety** | shadcn defaults: `--primary: #030213` (near-black, contradicts CD's `#1F4E7A`); ships a `.dark { … }` block (rejected by FR-052); chart tokens, sidebar tokens, oklch palette — none of which 007 uses |
| `package.json`, `pnpm-workspace.yaml`, `postcss.config.mjs`, `vite.config.ts`, `guidelines.zip`, `ATTRIBUTIONS.md` | **Ignore** | Generated scaffolding for the FM preview app, not relevant to 007 |
| `src.zip` | **Reject — never extract** | Generated React app source. Per the user's design-artifact rules, "Generated code from design tools is non-binding and must not be copied into production" |

**Decision.** Figma Make is the **secondary supporting reference** per
spec FR-051 priority (2). Adopt only its screen-coverage / contact-sheet
structure as a cross-check. Reject all generated source, the shadcn
default theme, the dark-mode block, and the implementation notes.

**Adopted from FM (concrete):**

- The 12-screen state inventory in `DELIVERABLES.md` table (cross-check
  vs CD `03-screens.md`).
- The viewport-band reminder (1280×720, 1366×768, 1440×900) — used
  to confirm the 1280 / 1024 viewport matrix the plan adopts.

**Rejected from FM by name (concrete):**

- `default_shadcn_theme.css` (rejected file).
- `IMPLEMENTATION_NOTES.md` (rejected file in entirety).
- `src.zip` (rejected archive — never extracted).
- All `.tsx` / `.css` / `.html` / `.js` deliverables across the
  package (generated source).

---

## R3 — Screenshot-tooling choice deferral pattern

**Question.** Should `/speckit-plan` pick a single screenshot tool
(Vitest + happy-dom, Playwright, manual capture) for every slice, or
defer per-slice?

**Decision.** Defer per-slice. The screenshot-acceptance contract
(`contracts/screenshot-acceptance.md`) names the per-surface viewport
matrix, pixel-diff thresholds, forbidden-content rules, and reviewer
sign-off protocol — but does NOT name the tooling. Each S0–S6
implementation slice picks its tool based on the surface(s) it touches:

- For state-variant primitives (Loading / Empty / Error /
  ScreenTooSmall): Vitest + happy-dom + RTL render + DOM snapshot is
  sufficient; pixel-diff is asserted by serialising the rendered DOM
  to a stable string and comparing.
- For shell chrome and route layouts: Playwright (already configured
  for 002 / 003 e2e if any) or manual browser capture; the slice's PR
  attaches PNG artifacts in the PR description (NOT committed to the
  repo per the binary-files rule).
- For animated regions (spinner, modal fade, rail expand): the slice
  may capture a fixed-frame screenshot via `page.locator(...).screenshot()`
  with `animations: 'disabled'` (Playwright option) or by rendering
  with `prefers-reduced-motion: reduce`.

**Alternative rejected — pin Playwright as the sole tool.** Rejected
because Playwright introduces an install footprint and a runner cost
that's not justified for the per-primitive variants in S2. Vitest +
happy-dom is sufficient there and runs in the existing CI step.

**Alternative rejected — pin Vitest + happy-dom as the sole tool.**
Rejected because happy-dom cannot accurately compute layout-dependent
visuals (e.g. a wrapped ellipsis on a long display name); the shell
slice's contact sheet needs real-browser pixel rendering.

---

## R4 — Per-slice exit-criteria template

**Question.** Per advisor guidance, each of S1 / S2 / S3 needs explicit
"approved when X, Y, Z" criteria so the 005 / 006 UI gate is auditable.
What's the template?

**Decision.** Each slice in `plan.md` §"Implementation Slices" carries
four sections:

1. **Goal.** One paragraph describing the visual outcome.
2. **Diff scope.** The exact paths the slice's PR may modify, by name.
3. **Definition of done.** A checklist of behavioural / visual criteria
   the implementer must satisfy. Items are concrete (e.g. "the PIN
   dot row markup carries no `value` attribute"), not aspirational
   ("PIN entry is secure").
4. **Screenshot-acceptance gate.** What contact sheet the implementing
   PR attaches and at what viewports.

For S1 / S2 / S3 specifically, a fifth section is added:

5. **Approval criteria for the 005 / 006 UI gate.** A short list of
   the 1–3 ticked items a reviewer must confirm against the
   implementing PR's evidence before that slice is considered
   "approved" for the gate.

The 005 / 006 UI gate is therefore audit-ticked: an external reviewer
walks each slice's "Approval criteria" section against the PR's diff
and tests, and the gate is unblocked only when all three slices' items
are ticked.

---

## Summary — what changes vs what stays

| Surface | What changes (S1+) | What stays (verbatim) |
|:--|:--|:--|
| Tokens | additive new entries: `--color-surface-sunken`, `--shadow-inset`, `--space-9`, `--duration-1..4`, `--ease-out`, `--ease-in-out`, possibly `--radius-1..6` aliases | every existing 003 token name + value (FR-003) |
| Font sans | (none — already aligned) | `--font-family-sans` chain unchanged |
| Font display | (none — Inter Tight rejected) | (no display family is added) |
| Font mono | (none — already aligned) | `--font-family-mono` chain unchanged |
| Theme | (none — single light theme) | no `.dark` block, no `prefers-color-scheme` follower |
| Primitives | restyle in place — paddings, radii, hover behaviour, shadow | every primitive's public prop signature (FR-014 … FR-021) |
| Shell chrome | restyle — top bar, rail, identity strip, connection indicator, operator slot | every shell region's existing role / display contract |
| Operator surfaces | restyle — roster, PinPad, TakeoverPrompt, OperatorBadge, ManagerAdminSignInForm | `messages.ts` closed-set refusal copy; PIN dot-only rule; TakeoverPrompt minimum-disclosure copy and forbidden-string set; OperatorBadge role + display-name only contract |
| Routes | restyle — pairing, paired, app placeholders | route logic, pairing-bypass contract, role-guard logic |
| Tests | extend tokens.test.ts parity test to cover additive entries; per-primitive variant coverage extended to recovered states | every existing test from 001 / 002 / 003 / 004 (NFR-013 ≥ 90 % gate held) |

---

*This document is the Phase 0 evidence base for the plan's decisions. It is
not a contract; it is a research record. The contracts under
`contracts/` are the authoritative artifacts that downstream slices
implement against.*

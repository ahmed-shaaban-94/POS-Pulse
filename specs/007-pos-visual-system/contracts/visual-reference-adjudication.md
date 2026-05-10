# Contract — Visual Reference Adjudication

**Feature:** 007-pos-visual-system
**Plan:** [../plan.md](../plan.md)
**Status:** planning-time contract. Once `src/renderer/styles/tailwind.css`,
`src/renderer/ui/tokens/`, `src/renderer/ui/primitives/`, `src/renderer/shell/`,
and `src/renderer/ui/operator/` land their S1–S5 restyles, the canonical
surface is the code; this file remains a frozen visual contract for the
plan-phase audit and for every subsequent UI feature's reviewer.

This contract codifies the priority-ordered visual reference set, the
adopt / adapt / reject lists, the rejection-by-name catalogue, and the
theme decision. It is the canonical reference for any reviewer auditing a
007 implementing PR or any future UI feature claiming inheritance from
007's visual recovery.

---

## Source-of-truth order

1. **Repo code + approved Spec Kit artifacts** are the source of truth.
   If any reference contradicts the live `src/renderer/styles/tailwind.css`,
   the live `src/renderer/ui/tokens/`, the live `src/renderer/ui/primitives/`,
   the live `src/renderer/shell/`, the live `src/renderer/ui/operator/`,
   or any approved Spec Kit artifact in `specs/`, **the repo wins**.
2. **Claude Design handoff** is the **primary visual reference**. When
   the repo is silent on a visual detail, Claude Design's handoff
   documents (`handoff/01-design-tokens.md` …
   `handoff/05-implementation-translation.md`, `ContactSheet.html`) carry
   the visual decision.
3. **Figma Make package** is the **secondary supporting reference**. Used
   only as a state-inventory cross-check and a contact-sheet structural
   pattern.
4. **Generated code from either tool is non-binding and MUST NOT be
   copied into production.** This applies to JSX, HTML, CSS, JavaScript,
   archived `src.zip` / `src/` directories, and any deliverable that
   ships compiled output.

The three repo references named in spec FR-051 priority (3) — namely
`specs/004-operator-session/visual-direction/README.md`,
`specs/004-operator-session/planning/ui-pinpad-takeover-visual-direction.md`,
and `specs/003-pos-ui-shell/contracts/` — remain **binding constraints**
that override (1) Claude Design and (2) Figma Make whenever they
disagree (Constitution Principle IX).

---

## Adopt — from Claude Design (primary)

| Domain | What is adopted | Source |
|:--|:--|:--|
| Visual identity | Deep enterprise navy primary (`#1F4E7A`); ink-on-white surface; dark rail at `#0E1B2A`–`#0B1726`; hairline borders; no left-border accent stripes on cards; calm shadow scale; no animation bounce | `handoff/01-design-tokens.md`, `handoff/02-components.md` |
| Tokens | Five-document token / component / screen handoff is the canonical visual translation brief. The repo already shares ~95 % of this surface (see `research.md` §R0); the remaining delta is captured in plan §"S1 — Token-layer additive deltas" | `handoff/01-design-tokens.md` |
| Components | Per-component visual guidance (paddings, radii, hover behaviour, shadow, focus-ring treatment) | `handoff/02-components.md` |
| Screens | Twelve-screen contact sheet defines the per-screen acceptance baseline. Each implementation slice renders its surfaces and compares against the relevant CD entry | `handoff/03-screens.md`, `ContactSheet.html` |
| Security | Hard-rule list (PIN dot-only, no JWT, no device token, no PIN, no PIN hash, no raw error payloads, no emoji) is mirrored verbatim in 007's slice gates | `handoff/04-security-and-visibility.md` |
| Translation | Translation-order recommendation (tokens → primitives → operator surfaces → state surfaces → shell regions → routes) informs slice ordering | `handoff/05-implementation-translation.md` |

Existing repo constraints from 003 and 004 remain binding and override
Claude Design on disagreement. Concrete examples:

- 003's `--space-0..8` scale is preserved verbatim; CD's `--space-1..9`
  parallel naming lands as additive (e.g. `--space-9: 96px` is added,
  but `--space-0..8` are NOT renamed to `--space-1..9`).
- 003's `--radius-{none,sm,md,lg,control,card,pane,pill}` naming is
  preserved verbatim; CD's `--radius-1..6,pill` parallel naming may
  land as additive aliases only if a slice needs them.
- 004 FR-013's takeover-modal copy is preserved byte-for-byte; CD's
  `02-components.md` "Dialogs / modals" section confirms but does not
  override.
- 004's closed-set refusal copy in `messages.ts` is preserved
  verbatim; CD's `04-security-and-visibility.md` §B mirrors but does
  not override.

---

## Adapt — from Figma Make (secondary)

| Domain | What is adapted | Caveat |
|:--|:--|:--|
| Screen coverage | Cross-check vs CD's 12-screen contact sheet for state-inventory completeness | FM's screen list mostly overlaps with CD's; any FM-only state must be evaluated against CD before adoption |
| Contact-sheet structure | The "screens × viewports × states" matrix shape | FM's specific viewport tuple (1280×720, 1366×768, 1440×900) informs the 007 plan's 1280 + 1024 viewport bands; the matrix shape is adopted, the specific values defer to spec NFR-012 + plan |
| Component treatments | Only where they improve touch clarity, spacing, or hierarchy AND do not contradict CD or repo | The plan does not pre-commit any specific FM adaptation; per-slice decisions document the source if any |
| Prototype flow | Used as a state-inventory cross-check (e.g. roster empty state, PIN error state, takeover modal in-flight state) | No flow logic is adopted |

---

## Reject — explicit by name

These are non-negotiable rejections. Any 007 implementing PR that copies
from a rejected source is grounds for refusal at review:

### Generated React / HTML / JSX / CSS as production source

- `claude-design/design-system/Components.jsx` (visual reference only).
- `claude-design/design-system/Screens.jsx` (visual reference only).
- `claude-design/design-system/ExtraScreens.jsx` (visual reference only).
- `claude-design/design-system/kit-styles.css` (visual reference only —
  extract values, never copy file).
- `claude-design/design-system/proto-styles.css` (visual reference only).
- `claude-design/design-system/tokens.css` (visual reference only —
  extract values, never copy file).
- `claude-design/Deck.html`, `Prototype.html`, `ContactSheet.html`,
  `index.html`, `deck-stage.js`, `deck-styles.css` (visual reference
  only).
- `figma-make/POS-figam-2/src.zip` (generated React app — never
  extract or read into the repo).
- All `.tsx` / `.css` / `.html` / `.js` under `figma-make/POS-figam-2/`
  (generated output — non-binding even when extracted).

### shadcn / default theme copied as-is

- `figma-make/POS-figam-2/default_shadcn_theme.css` is a 100-line
  shadcn defaults file with `--primary: #030213` (near-black) that
  contradicts CD's navy `#1F4E7A` and the live repo's `#1F4E7A`.
  The file also ships a `.dark { … }` block (rejected by spec FR-052)
  and chart / sidebar tokens 007 does not need. **Reject the file in
  its entirety.**

### Dark mode or dark tokens for 007

- Any `.dark { … }` block.
- Any `prefers-color-scheme: dark` selector.
- Any per-tenant theme switch.
- Any runtime theme toggle.

The recovered surfaces MUST render the same light theme regardless of
the user's OS-level `prefers-color-scheme` setting. Spec FR-052 is
binding.

### Backend / database / routing / PIN-validation guidance from Figma Make

- `figma-make/POS-figam-2/IMPLEMENTATION_NOTES.md` includes
  Argon2-flavoured PIN-validation patterns, SQLite migration
  scaffolding, IPC handler examples, and React Router proposals — all
  of which contradict 004's AD-1 / AD-2 / Approval Gate §A1, NFR-001,
  and the spec's renderer-only posture (FR-050). **Treat the entire
  file as non-binding.**

### Dashboard stats, KPIs, sales quick actions, reports, or analytics surfaces

- CD `03-screens.md` §10b (manager shell with KPI tiles) is visual
  direction for a future feature, not a 007 deliverable.
- FM `DELIVERABLES.md` §"DashboardContent" describes "stats cards" and
  "quick actions" — also not a 007 deliverable.

Spec FR-045 forbids reports / KPIs / dashboards / analytics surfaces
in 007. The CD §10b sketch is preserved in the contact-sheet contract
but no 007 slice produces real KPI tiles.

### Takeover-modal disclosures

The takeover modal MUST NOT contain, by name:

- The other terminal's name, ID, location, or device token.
- The other operator's name, role, or initials.
- The timestamp of the prior sign-in.
- Any "view details" affordance, expandable section, hover-tooltip,
  or "advanced" link.
- Any reason / debug / trace ID.

Both CD `04-security-and-visibility.md` §C and CD `02-components.md`
§"Dialogs / modals" enforce this; the plan re-states it as a binding
constraint per spec FR-029. The S5 implementation slice's screenshot
test asserts these strings are absent from the modal subtree.

### Any "production-ready" claim from generated design tools

- FM `DELIVERABLES.md` claims "all components production-ready" and
  "ready for implementation handoff" — those claims are noise; the
  plan ignores them.
- FM `IMPLEMENTATION_NOTES.md` claims certain components "are
  production-ready" — those claims are also noise.

Production-readiness is determined by the implementing PR's tests,
the screenshot-acceptance contract, and the reviewer sign-off — never
by claims from external reference packages.

### Emoji

- No emoji in production code.
- No emoji in copy.
- No emoji in logs.
- No emoji in screenshot labels.
- No emoji in contact-sheet captions.
- No emoji in PR descriptions for 007 slices.

CD `04-security-and-visibility.md` §A explicitly forbids emoji; the
spec inherits. Both reference packages contain emoji-laden
documentation; that styling is non-binding.

---

## Theme decision (re-stated for plan-phase audit)

- **One polished light theme only.** No `.dark` block, no
  `prefers-color-scheme` follower, no per-tenant theme switch.
- **Inter as primary, system-UI as fallback when Inter is
  unavailable.** The live `--font-family-sans` chain
  (`'Inter Variable', Inter, 'Segoe UI', system-ui, -apple-system,
  sans-serif`) already satisfies this and is preserved.
- **No proprietary brand fonts beyond Inter.** Inter Tight is
  rejected (use Inter weight-700 + negative letter-spacing for
  tight display feel). JetBrains Mono is preserved only as a
  fallback in `--font-family-mono`; the primary mono face is the
  OS-provided `ui-monospace`. The recovered surfaces MUST NOT
  regress visually if Inter Variable / Inter is missing from the
  target Windows 10 / 11 terminal — the system-UI fallback is the
  acceptance baseline.
- **The Inter delivery mechanism (bundled webfont,
  ship-with-installer, OS pre-install, or other) is a downstream
  `/speckit-tasks` decision**, not pinned by this plan.

---

## Auditor checklist

A reviewer auditing a 007 implementing PR walks this checklist:

- [ ] **Source-of-truth ordering preserved.** No file under
      `src/renderer/` contradicts an approved Spec Kit artifact in
      `specs/`. If a contradiction exists, the spec / plan / contract
      is amended first; the code follows.
- [ ] **No rejected source copied.** No file in the repo contains
      content lifted from any of the rejected sources named above.
      A `git diff` audit of the implementing PR shows no copy-paste of
      JSX / HTML / CSS / JavaScript from any reference.
- [ ] **No `.dark` block.** No file under `src/renderer/styles/` or
      anywhere else introduces a `.dark { … }` selector or any
      `prefers-color-scheme: dark` follower.
- [ ] **No proprietary brand font added.** No new `@font-face`
      declaration referencing Inter Tight, JetBrains Mono as a primary
      face, or any other proprietary brand font is added by the
      implementing PR.
- [ ] **No emoji.** Production code, copy, screenshot labels, and PR
      description are emoji-free.
- [ ] **Cashier-Forbidden Information walling preserved.** No
      cashier-reachable surface added or restyled by the
      implementing PR exposes any item from the 004 FR-015 catalogue
      (shift totals, expected drawer cash, expected change-fund,
      declared cash count, shortage, overage, variance, reports,
      KPIs, manager-review data, audit log surfaces, admin
      surfaces, other operators' shift data).
- [ ] **TakeoverPrompt minimum-disclosure preserved.** The modal
      subtree under `[data-testid="takeover-prompt"]` contains zero
      occurrences of the FR-013 forbidden-string set.
- [ ] **PIN dot-only preserved.** The PIN dot row markup carries no
      `value`, no `data-value`, no `title` attribute referencing PIN
      content. Only `data-state` and `aria-label="N of 6 entered"`.
- [ ] **No binary design file committed.** No PNG, JPG, ZIP, PDF, or
      generated source archive is staged or committed by the
      implementing PR.
- [ ] **Static no-touch source-scope guard passes.** No diff lines
      under `src/preload/**`, `src/main/ipc/**`, `src/main/pairing/**`,
      `src/main/secrets/**`, `src/shared/bridge-api.ts`,
      `src/shared/api-types.ts`, `migrations/**`,
      `scripts/codegen-api.ts`, `scripts/openapi-snapshot.json`,
      `.github/workflows/**`.

---

*This contract is a planning-time snapshot. Once code lands the S1–S5
restyles, the canonical surface is the code; this file remains a
frozen visual contract for the plan-phase audit and for every
subsequent UI feature's reviewer.*

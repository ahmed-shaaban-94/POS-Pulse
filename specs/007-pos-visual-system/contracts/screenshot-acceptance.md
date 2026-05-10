# Contract — Screenshot Acceptance

**Feature:** 007-pos-visual-system
**Plan:** [../plan.md](../plan.md)
**Status:** planning-time contract. Once S6 finalises this contract,
the canonical merge gate for every subsequent UI feature is this
document.

This contract codifies the per-surface, per-state screenshot acceptance
criteria, viewport bands, pixel-diff thresholds, contact-sheet
attachment requirements, reviewer sign-off protocol, and forbidden-
content rules. It is the canonical reference for any 007 implementing
PR (S0–S6) and for every subsequent UI feature (005, 006, and any
future UI slice) that inherits the recovered visual system.

---

## Per-PR contact sheet — what every implementing PR attaches

Every 007 implementation slice's PR (S0 baseline, S1 token deltas, S2
primitives polish, S3 shell, S4 pairing surfaces, S5 operator
surfaces, S6 contract finalisation) — and every subsequent UI feature
inheriting 007's visual recovery — attaches:

1. **A contact sheet** of the surfaces the slice or feature touches.
2. **The per-surface, per-state, per-viewport screenshot files**
   referenced by the contact sheet.
3. **A reviewer sign-off note** in the PR description, recording which
   reviewer verified the contact sheet and on what date.
4. **A forbidden-content audit** confirming the screenshots contain
   no items from the forbidden-content list below.

---

## Viewport matrix (mandatory)

Every contact sheet covers, at minimum, these two viewports:

| Viewport | Use | Display scaling tested |
|:--|:--|:--|
| **1280 × 800** | Primary cashier monitor (≥ 1280 px expanded rail) | 100 % (default), 125 %, 150 % |
| **1024 × 768** | Secondary supported viewport (icon-only rail) | 100 % (default) |

Viewports below 1024 px are NOT a target production viewport and are
covered by the `ScreenTooSmall` fallback in the shell. No mobile
hamburger drawer is ever rendered.

If a slice changes a layout that responds to Windows display scaling,
the contact sheet additionally covers 125 % and 150 % at 1280 × 800.
Otherwise the 100 % capture is sufficient.

---

## Per-surface state matrix (mandatory)

Every surface a slice touches gets at least these states in its
contact sheet:

| Surface category | Required states |
|:--|:--|
| Pairing screens | default, pairing-in-progress, paired-ready, paired-failed |
| Cashier roster | default (with cashiers), empty roster, roster-picked |
| Manager / admin sign-in | default, entering, submitting, generic-failure (variants A / B / C) |
| PinPad | default, dot-row 1-of-6 entered, dot-row full, error flash, locked-out, submitting |
| TakeoverPrompt | default (modal open), confirming, cancel-pressed, error |
| Signed-in shell (cashier) | default (operator badge cashier), connection-online, connection-degraded, connection-offline, connection-syncing |
| Placeholder routes | default, loading, empty, error |
| Status banner | success, warning, danger, syncing |
| Dialog | default open, action-pressed, dismiss-pressed |
| Reduced-motion variants | every surface that contains animation (spinner, modal fade, rail expand) — captured with `prefers-reduced-motion: reduce` |

Slices that touch only a subset of surfaces attach only the relevant
states.

---

## Pixel-diff thresholds

The implementing PR's contact-sheet review compares the new
screenshots against the S0 baseline (or, for surfaces introduced after
S0, against the slice's own immediate-prior baseline).

| Surface category | Threshold |
|:--|:--|
| Layout-stable surfaces (default, roster-picked, paired-ready, sign-in default, takeover default-prompt) | **≤ 0.5 %** per-pixel diff |
| Surfaces with animated regions (submitting, confirming, modal fade-in, spinner-active) | **≤ 1.5 %** per-pixel diff |
| Surfaces with `prefers-reduced-motion` variant | the reduced-motion variant has a **separate baseline**; the active-motion variant compares against the active-motion baseline only |

The S0 implementing slice MAY tune these thresholds per-surface based
on the "before" baseline if happy-dom or Playwright produces
sub-pixel rendering noise that would otherwise spuriously fail at
0.5 %. Any tuning is recorded in the S0 PR description and propagated
into this contract via S6's amendment.

---

## Forbidden content in screenshots

A screenshot attached to any 007 implementing PR (or any subsequent
UI feature inheriting 007's recovery) MUST NOT contain:

### Cashier-reachable surface screenshots — no Cashier-Forbidden Information

Screenshots of any cashier-reachable surface MUST NOT depict items
from the 004 FR-015 catalogue:

- Shift totals
- Expected drawer cash
- Expected change-fund
- Declared cash count
- Shortage
- Overage
- Variance
- Reports of any kind
- KPIs of any kind
- Manager-review data
- Audit log surfaces
- Admin / configuration surfaces
- Other operators' shift data

Manager-only or admin-only surfaces MAY depict these items, but the
implementing PR's reviewer must redact / mock financial values before
attaching when the screenshot might surface in a public review channel.

### TakeoverPrompt screenshots — minimum-disclosure forbidden strings

A screenshot of any TakeoverPrompt state's modal subtree
(`[data-testid="takeover-prompt"]`) MUST NOT contain:

- The string `POS-` (terminal-label prefix from 003's pairing).
- The substring `ago` (any timestamp-relative wording).
- The substrings `Cashier ` (with trailing space), `Manager`, `Admin`
  (other-operator role).
- Any 4-digit time pattern matching the regex `\d{2}:\d{2}` (e.g. a
  timestamp like `14:23`).
- The strings `View details`, `Why am I seeing this`, `Show details`
  (or any equivalent expandable-affordance label).

The S5 implementing slice's test suite includes a render-time DOM
assertion confirming these strings are absent from the modal subtree.

### Per-screenshot generic forbidden content

Every screenshot, regardless of surface:

- No PII beyond an operator's display name (first name + last initial
  is the maximum; no email, no phone, no address).
- No Clerk JWT, no `device_token`, no session token, no API key.
- No PIN value, no PIN hash, no credential fragment.
- No raw cardholder data (PAN, CVV, expiry).
- No raw error payload (e.g. `INVALID_CREDENTIALS`, `401`, `409`,
  stack trace, trace ID).
- No emoji.
- No mockup-only artifacts (`Lorem ipsum…`, `placeholder`, the strings
  "TODO" / "FIXME" / "XXX").

---

## Reviewer sign-off protocol

The implementing PR's description records:

1. **Reviewer name and date** for each contact-sheet entry.
2. **Confirmation that the forbidden-content audit was performed** and
   no items from the lists above appear in any attached screenshot.
3. **Confirmation that the pixel-diff threshold was met** for every
   captured surface.
4. **Any threshold tuning** recorded in this PR (referencing the S6
   amendment in the contract).

The reviewer is a designated person (typically the product owner, a
senior engineer, or a designer); the implementing PR's author may NOT
self-approve the contact sheet.

---

## Tooling — deferred per slice

This contract does NOT pin a single screenshot tool. Each slice picks
its tool based on the surfaces it touches:

- **State-variant primitives** (Loading / Empty / Error /
  ScreenTooSmall): Vitest + happy-dom + RTL render + DOM snapshot is
  sufficient. Pixel-diff is asserted by serialising the rendered DOM
  to a stable string and comparing.
- **Shell chrome and route layouts** (S3 + S4 + S5): Playwright (if
  available) or manual browser capture. PNG artifacts attach to the
  PR description. PNG files are NOT committed to the repo.
- **Animated regions**: capture a fixed-frame screenshot via
  `page.locator(...).screenshot()` with `animations: 'disabled'`
  (Playwright) or render with `prefers-reduced-motion: reduce`.

The S0 implementing slice may pick a tool for the baseline contact
sheet; subsequent slices match the S0 tool unless a documented reason
applies.

---

## Storage of attached screenshots

Per the user's design-artifact rules and spec NFR-002:

- **Screenshots are NOT committed to the repo.** No PNG, JPG, ZIP, or
  PDF is staged or committed by any 007 implementation slice.
- **Screenshots attach to the PR description** via GitHub's upload
  surface (drag-and-drop into the PR description body). GitHub
  hosts the files; the repo references them only by URL.
- **The contact-sheet "index"** (a markdown table or list summarising
  every screenshot) MAY appear in the PR description, but does NOT
  land in the repo as a file.

This rule preserves the no-binary-design-files-committed discipline.

---

## 005 / 006 UI gate audit

A reviewer auditing whether 005 / 006 UI implementation may begin
walks the gate criteria from the plan's per-slice "Approval criteria
for the 005 / 006 UI gate" sections, against the relevant S1 / S2 / S3
implementing PR's evidence.

The reviewer ticks the criteria in the 005 / 006 implementing PR's
description, citing the three 007 slice PRs (S1 PR #, S2 PR #, S3 PR #).

---

## Amendment history

This contract is amended by S6's implementing PR after the S0–S5
slices have run their course. Amendments may include:

- Per-surface pixel-diff threshold tuning (recorded with the
  measurement evidence that motivated the change).
- Additional forbidden-content rules learned from review (e.g. a
  surface that turned out to leak a previously-unanticipated string).
- Amendments to the per-surface state matrix when a new state is
  introduced (e.g. a "stuck-shift" state reaching cashier visibility
  by mistake — recorded as an additional forbidden state).

Any amendment is a documented change to this contract; the change
takes effect for every PR opened after the amendment merges.

---

*This contract is the canonical merge gate for every subsequent UI
feature inheriting 007's visual recovery. Spec FR-030 / FR-031
reference it; NFR-014's 005 / 006 UI gate audit relies on it; the
auditor checklist in `visual-reference-adjudication.md` complements
it.*

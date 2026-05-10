# 007 POS Visual System — Regression Checklist

This checklist documents the six load-bearing guard families established during S1–S5.
For each guard, it records:

- **What is protected** — the invariant that must not regress
- **Enforcement mechanism** — automated test, or reviewer audit with specific artefact
- **Introduced** — the slice and PR that established the guard
- **Scope trigger** — which kinds of changes require this guard to be re-verified

---

## Guard 1 — Token additivity (FR-003)

**What is protected:** No existing design token defined in S1 (`tailwind.css`,
`src/renderer/ui/tokens/`) is renamed or removed. New tokens may be added; existing tokens may
only gain new usages. Removing a token used by multiple surfaces would silently break any surface
the author did not test.

**Enforcement:** Reviewer audit + `git diff`. Before approving any PR that touches
`tailwind.css` or files under `src/renderer/ui/tokens/`, the reviewer runs:

```
git diff main...HEAD -- src/renderer/ui/tokens/ tailwind.css
```

and confirms no `-` line removes a CSS custom property that was present on `main`.

No automated test. The auditor checklist in `contracts/visual-reference-adjudication.md` (item:
"token additivity") carries this check.

**Introduced:** S1, PR 113.

**Scope trigger:** Any PR that modifies `tailwind.css` or any file under `src/renderer/ui/tokens/`.

---

## Guard 2 — TakeoverPrompt forbidden-string assertions (FR-013)

**What is protected:** The takeover-prompt surface must never render the pending terminal name or
ID, the other operator's identity or role, a timestamp, or any CTA that implies the operator can
learn the cause ("View details", "Why am I seeing this", "Show details"). Minimum-disclosure is a
hard security requirement: operators must not be given information that allows social engineering
or session-hijacking of the ongoing session.

**Enforcement:** Automated test — `src/renderer/ui/operator/__tests__/TakeoverPrompt.forbidden-strings.test.tsx`
(10 assertions). Runs in CI on every push.

**Introduced:** S5, PR 117.

**Scope trigger:** Any PR that modifies `TakeoverPrompt.tsx` or its CSS / token usage.

---

## Guard 3 — Cashier-Forbidden Information walling (FR-006 / FR-031)

**What is protected:** Cashier-facing surfaces must not render shift totals, KPIs, drawer cash
amounts, operator IDs, or management-only identifiers in any DOM node (visible or hidden). A
cashier holding a session must not be able to read financial or operator-identity data through any
surface they can reach during a normal shift.

**Enforcement:** Automated test — `src/renderer/__tests__/cashier-walling.test.tsx`
(5 assertions). Runs in CI on every push.

**Introduced:** S5, PR 117.

**Scope trigger:** Any PR that modifies cashier-reachable surfaces
(`RosterList`, `OperatorBadge`, `PinPad`, `CashierWorkspace`, `PosShell` while a cashier session
is active).

---

## Guard 4 — PIN dot-only markup (PR-1)

**What is protected:** PIN digits must never appear as text content in the DOM. The PinPad
component represents each entered digit as a filled dot marker (`data-state="filled"`) with an
accessible aria-label of the form "N of 6 entered" — never a numeric character. A regression here
would leak a user's PIN to anyone who can read the DOM (e.g. via browser devtools or an
accessibility tree scrape).

**Enforcement:** Automated test — `src/renderer/ui/operator/__tests__/PinPad.dot-only-guard.test.tsx`
(9 assertions). Runs in CI on every push.

**Introduced:** S5, PR 117.

**Scope trigger:** Any PR that modifies `PinPad.tsx` or its test helpers.

---

## Guard 5 — No `prefers-color-scheme` follower / no dark mode

**What is protected:** The 007 visual system is a single fixed light theme. No component or global
stylesheet may introduce a `@media (prefers-color-scheme: dark)` block or a `.dark` CSS class tree.
Following the OS colour scheme would cause the interface to diverge from the adjudicated visual
reference (S0, PR 109) in any dark-mode environment and would invalidate the contact-sheet
evidence.

**Enforcement:** Reviewer audit. Before approving any PR that touches `tailwind.css`,
`src/renderer/ui/tokens/`, or any component stylesheet, the reviewer confirms that no
`prefers-color-scheme` query and no `.dark { … }` block appears in the diff.

The auditor checklist in `contracts/visual-reference-adjudication.md` (item: "no `.dark` block")
carries this check. No automated test.

**Introduced:** S0 adjudication; codified as a guard in S6.

**Scope trigger:** Any PR that touches CSS, token files, or Tailwind configuration.

---

## Guard 6 — No proprietary brand fonts beyond Inter

**What is protected:** The 007 visual system uses Inter as its sole typeface. No `@font-face`
declaration for a font other than Inter may be introduced. Proprietary brand fonts are not licensed
for this project and would fail on end-user machines without the font installed, silently degrading
to the fallback stack in ways that may violate the adjudicated visual reference.

**Enforcement:** Reviewer audit. Before approving any PR that touches `tailwind.css`,
`src/renderer/ui/tokens/`, or any stylesheet, the reviewer confirms that no new `@font-face` for
a non-Inter font appears in the diff.

The auditor checklist in `contracts/visual-reference-adjudication.md` (item: "no proprietary brand
font") carries this check. No automated test.

**Introduced:** S0 adjudication; codified as a guard in S6.

**Scope trigger:** Any PR that touches CSS, font imports, or Tailwind configuration.

---

## Quick reference

| # | Guard | Enforcement | Test file |
|:--|:------|:------------|:----------|
| 1 | Token additivity | Reviewer audit + `git diff` | — |
| 2 | TakeoverPrompt forbidden strings | Automated (CI) | `src/renderer/ui/operator/__tests__/TakeoverPrompt.forbidden-strings.test.tsx` |
| 3 | Cashier-Forbidden Information walling | Automated (CI) | `src/renderer/__tests__/cashier-walling.test.tsx` |
| 4 | PIN dot-only markup | Automated (CI) | `src/renderer/ui/operator/__tests__/PinPad.dot-only-guard.test.tsx` |
| 5 | No dark-mode follower | Reviewer audit | — |
| 6 | No proprietary fonts beyond Inter | Reviewer audit | — |

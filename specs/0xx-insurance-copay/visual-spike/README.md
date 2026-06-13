# Insurance / Co-pay Tender — Visual Spike

> **Status: design validation only. The real feature is 🔴 BLOCKED** (see *Preflight
> verdict* below). This folder is an **unwired prototype** — it imports nothing from the
> real payment flow, touches no tender enum, persists nothing, and calls no IPC. It exists
> so the team can see and critique the design in the production token system *before*
> committing to the contract work the real feature would require.

Source handoff: `design_handoff_insurance_copay` (`pos v 3.0 (2).zip`) — adds a health-insurance
co-pay split as a tender method: the insurer reimburses a % of the *eligible* (medicine) basket;
the patient pays the remainder (the co-pay) in cash.

---

## How to view

**Browser (standalone, fastest):**
```bash
npx vite specs/0xx-insurance-copay/visual-spike --port 5191 --strictPort
# open http://localhost:5191/
```

**Run the tests (math + render):**
```bash
npx vitest run -c specs/0xx-insurance-copay/visual-spike/vitest.spike.config.ts
# 19 passed — 14 pure-math (no-drift/fully-covered/no-eligible/gating)
#           +  5 render-smoke (mounts, plan-select reveals breakdown, valid
#              member+co-pay enables confirm) via happy-dom.
```

`preview.png` is a captured screenshot of the rendered panel (initial no-plan state).

## Files
| File | Role |
|---|---|
| `copay-math.ts` | Pure, contract-free co-pay arithmetic (integer minor units, round-once). The genuinely portable core. |
| `copay-math.test.ts` | 14 tests proving no-drift, fully-covered, no-eligible, gating. |
| `InsuranceTenderSpike.tsx` | The panel — plan picker, member field, breakdown, co-pay keypad, change, all states. Unwired; `onConfirm` is a `console.info` no-op. |
| `InsuranceTenderSpike.render.test.tsx` | 6 render-smoke tests (happy-dom): mounts, breakdown reveal, confirm gating, member auto-focus on plan select. |
| `index.html` + `main.tsx` | Standalone Vite harness. |
| `preview.png` | Captured screenshot of the rendered panel (no-plan state). |
| `vitest.spike.config.ts` | Throwaway config so the tests run under `specs/` without touching the root config. |

What it demonstrates (verified: typecheck-clean, ESLint exit 0 + Prettier-formatted, 20/20 tests,
rendered + screenshotted): the 4 demo plans, eligibility split (medicine vs device, incl. the `تغطية ٠٪`
not-covered marker on the device line), the `covered`/`patientDue`/`change` math, fully-covered (100%)
path, no-eligible-items path, member-id validation + ✓ chip, member-field auto-focus on plan select,
strong disabled confirm, RTL, the real tokens (navy primary, success-as-text-only, Quiet-Edge borders,
mono money), and ≥44px targets. The teal accent is intentionally unused (One-Accent Rule).

---

## Accessibility / state audit — applied + carry-forward

A scoped `impeccable audit` (accessibility · RTL/bidi · interaction-state coverage only; visuals are
locked by the handoff and were out of scope) was run on the spike. Anti-patterns passed cleanly; the
visual layer is faithful. One finding was applied; the rest are recorded here as **carry-forward for
the real feature** (they belong in the production build against the real primitives, not in a throwaway
spike).

**Applied (this spike):**
- ✅ **Auto-focus the member field when a plan is selected** — the cheapest hop of handoff §7's focus
  flow. Done in the `selectPlan` event handler via `requestAnimationFrame`; covered by a render test.

**Carry-forward (deferred — implement in the production feature, not here):**
- **Radiogroup keyboard support** — plan rows have `role="radio"` + `aria-checked` but no roving
  `tabIndex` / Arrow-key handling, so the radiogroup isn't truly keyboard-operable (WCAG 2.1.1 / 4.1.2).
- **Full focus choreography** — member → keypad → confirm; only the first hop (→ member) is implemented.
- **`Enter` confirms / `Esc` returns to cart** — handoff §7 shortcut behavior; not wired (and must not
  shadow the app's global F-keys when ported).
- **Confirming / loading state** — §3 specifies a spinner + "جارٍ التأكيد…" with inputs locked + a
  double-submit guard (a pure UI latency guard, no network). Absent.
- **Error-on-attempt state** — §3: confirming while the member is invalid should redden the inline hint
  and focus the field. Currently `aria-invalid` is set but the hint never turns red.
- **Persistent `aria-live` change announcement** — the live region currently mounts with the change row
  (only when a co-pay is due); a region that appears with its first content may not be announced.
  Render a persistent visually-hidden live region instead (WCAG 4.1.3).
- **RTL / bidi isolation for money + member values** — wrap money (`−EGP …`) and the member id in a
  Unicode bidi isolate (`<bdi>` / `⁦…⁩`) rather than the `dir`/`startsWith` heuristic, for
  robust sign/caret placement on all Windows browsers.

None of these change the locked visual direction — they are interaction/a11y layers the handoff §7/§3
already require of the real feature.

## Preflight verdict — why the real feature is BLOCKED

Run against the actual repo per the handoff's `CLAUDE.md §1`. Two blockers have **no sanctioned
UI-only escape**:

1. **A tender method is a cross-process, exhaustiveness-enforced contract here — not a renderer
   concern.** The tender kinds are a closed enum in three shared modules
   (`src/renderer/ui/payments/TenderSelection.tsx`, `src/shared/sales/types.ts` —
   *persisted on the Sale row*, `src/shared/payments/types.ts`), and the main-process finalize
   transaction branches on `line.tender_type` per kind
   (`src/main/sales/finalize-transaction.ts:265–275`). Adding `'insurance'` means editing the
   shared tender vocabulary **and** main-process finalize logic — the `CLAUDE.md §2.6` hard-stop.

2. **The DP-2 sale-capture contract actively *rejects* the insurance fields.**
   `Data-Pulse-2/apps/api/src/catalog/sales/dto/capture-sale-request.dto.ts` is `.strict()` with an
   explicit mass-assignment ban: *any unknown key → deterministic validation failure*. There is no
   insurer / member / covered / patientDue field, and adding one is rejected at the boundary.

Underneath both: production is a **main-process / IPC-bridge / async** payment flow
(`payments.start` → per-line `tender.apply` → `payments.confirm`, finalized by a background AD-2
worker). The renderer never assembles the sale object — by Constitution design it cannot.

A third issue — the math model has **no data**: the cart envelope (`handoff-envelope.ts`) carries
`subtotal_minor` only, no VAT and no per-line eligibility flag; 008 hardcodes tax = 0 (VAT deferred
to 008-v2). So even the sanctioned eligibility stub has nothing real to compute against. (The spike
sidesteps this with an explicit per-line `eligible` boolean on stub data.)

Also: the handoff says *"insurance mirrors the credit branch"* — but production has **no credit
method** (only cash / card / voucher). The prototype was written against a different build.

## The 5 open questions for product / DP-2 (HANDOFF §10)
1. Are insurer + member + covered + patientDue **persisted** on the sale, and under what field names?
2. Is there a **claim/sync lifecycle** (submitted / accepted / rejected)? If so it needs states this design omits.
3. Should plans come from the **platform catalogue** rather than a static list?
4. Is **mixed tender** (insurance + card/voucher for the co-pay) in scope? Co-pay is cash-only today.
5. Is "VAT-exempt medicine" the eligibility source of truth, or should it be an explicit per-product
   `insuranceEligible` flag? (Today neither exists — there is no VAT model at all.)

## What unblocks the real feature
- A DP-2 sale-capture contract that carries the insurance fields (extends the `.strict()` capture DTO).
- A VAT / total model on the cart + sale (008-v2), giving eligibility real data.
- Extending the shared tender enum + main-process finalize transaction to handle `'insurance'`.

Each is out of UI-only scope and needs product + DP-2 sign-off. Until then, this spike is the deliverable.

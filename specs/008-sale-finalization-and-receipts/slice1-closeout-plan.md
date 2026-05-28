# Slice 1 Closeout Implementation Plan (T028a + T094b + T094c)

**Author:** Claude (Opus 4.8) · **Date:** 2026-05-29 · **Status:** in progress
**Branch:** `feat/008-slice1-closeout` (off main)
**Skill discipline:** `superpowers:test-driven-development` (RED→GREEN per step). Per-file ≥95% L/B/F/S coverage gates enforced in `vitest.config.ts`.

## Context

PR #273 merged T094a (pairing handshake + terminal_assignment carries the 6 branch/printer
fields). Remaining Slice 1 code: **T028a, T094b, T094c**. Then **T111/T112/T113** are
`[HUMAN]` dev-build smokes + sign-off — Claude cannot execute these; they require Ahmed
to run a packaged dev build with real hardware/fixtures.

## Two sourcing gaps (resolved via research + Ahmed)

1. **Operator display_name** — NOT in payment_attempts / payment.settled payload /
   OperatorSessionForPayments. Worker runs at boot (T112 recovery) with no live session.
   **Ahmed decision: persist-at-settlement.** Add `selling_operator_display_name` to the
   `payment.settled` audit payload, sourced from the live session at confirm-time.
   - `sales.selling_operator_display_name` is ALREADY `NOT NULL` (migration 0020) — schema
     already committed to persisting it; we're completing plumbing.
   - `operatorSessionManager.getCurrent()` HAS `display_name`; the `paymentsSessionAdapter`
     (index.ts:579) currently drops it. Thread it through → `OperatorSessionForPayments`.
   - In-pattern with T094a reaching into signed-off 002. payment.settled is an INTERNAL
     audit shape, not a §A4 renderer contract — no gate, no 006 re-sign-off. Note in PR body.

2. **Cart item lines (T028a source)** — RESOLVED, queryable. Full `PaymentIntentEnvelope`
   (with all 9 `LineSnapshot` fields) is JSON-persisted in `carts.handoff_envelope_json`;
   frozen cart survives (`state='frozen_handed_off'`). Worker has `envelope_cart_id` and
   reads via `cartStore.getCart(cart_id).handoff_envelope_json`. Use the FROZEN envelope
   JSON (immutable), not mutable `cart_lines` rows — byte-stable reprints (FR-015/FR-016).

## Build order (each its own RED→GREEN)

### Step 0 — 006 widening (sub-step of the display_name decision)
- RED: extend payments audit-emitter test to assert `payment.settled` payload carries
  `selling_operator_display_name`; extend `OperatorSessionForPayments` fixture usage.
- GREEN:
  - Add `display_name: string` to `OperatorSessionForPayments` (required).
  - `paymentsSessionAdapter` (index.ts) sources `sess.display_name`.
  - `payments-confirm.ts` passes `selling_operator_display_name: session.display_name`
    into `emitPaymentSettled`.
  - payments audit-emitter `emitPaymentSettled` adds the field to the payload object.
- Fixtures: grep 006 payments tests for `OperatorSessionForPayments` construction; add the
  field everywhere. Make it REQUIRED (mirrors sales NOT NULL).

### Step 1 — T028a migration + lines_json plumbing
- Migration `0028_extend_sales_with_lines_json.sql` (NOT 0027 — 0027 is taken by T094a):
  `ALTER TABLE sales ADD COLUMN lines_json TEXT NOT NULL DEFAULT '[]'`.
- RED: migrations integration test asserts column exists + JSON round-trip insert/read.
- GREEN: `SaleRow` gains `lines_json: string`; repo INSERT + SELECT carry it; `FinalizeInput`
  gains `lines: readonly LineSnapshot[]`; finalize-transaction serializes `JSON.stringify(input.lines)`
  into the INSERT. Shared `LineSnapshot` type already at `src/shared/cart/handoff-envelope.ts`.

### Step 2 — T094b finalize-dispatch.ts (projection)
- RED: unit tests for `buildFinalizeInput(handoff_action_id)`:
  happy-path projection; all gap-field hydration (branch_name/address/tax-reg from
  terminal_assignment); display_name from payload; lines from frozen envelope JSON;
  total_change_due_minor = Σ cash-line change_due_minor; local_calendar_day = terminal-TZ
  of settled_at; missing-row refusal paths (no audit row / no attempt / no envelope).
- GREEN: module reads audit_events by handoff_action_id (json_extract), joins
  payment_attempts + payment_tender_lines + terminal_assignment + frozen cart envelope.
  `total_tax_minor = 0` with `// TODO(008-v2): Egyptian VAT compliance — see coordination.md`.
  Inject a `resolveSellingOperatorDisplayName` seam (reads from payload by default).
  ≥95% L/B/F/S.

### Step 3 — T094c wiring (index.ts + new src/main/ipc/sales.ts)
- New `src/main/ipc/sales.ts` mirroring `src/main/ipc/payments.ts`: `registerSalesHandlers`.
  RED: unit test on the IPC registration (channel→handler mapping, invalid-input refusal).
- GREEN wiring in index.ts behind `saleFinalization` flag (env POS_PULSE_FEATURE_SALE_FINALIZATION):
  - construct finalize-listener with dispatch = projection (T094b) → bindFinalizeTransaction.finalize()
  - dispatchPrintRecovery / dispatchDrawerRecovery = logger.warn placeholders (S3/S4 land real)
  - register sales.* IPC after registerPaymentsHandlers
  - runStartupRecovery() then start() inside whenReady (scope tenant/branch/terminal from pairing row)
  - finalizeListener.stop() on quit / window-all-closed alongside closeDbHandle()

## Verification before PR
- `npm run typecheck` (both tsconfigs)
- `npm run lint` (eslint + prettier --check) — run prettier first per memory feedback
- `npx vitest run` on the touched modules with --coverage; confirm per-file ≥95%
- Full `npm test` green

## Out of scope / cannot complete
- T111/T112/T113 = `[HUMAN]` dev-build smokes + Slice 1 sign-off. Land code; Ahmed runs smokes.

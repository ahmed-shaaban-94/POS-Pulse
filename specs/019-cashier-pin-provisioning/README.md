# 019 — Cashier-PIN Provisioning (004 follow-up) — TRACKING STUB

> **⚠️ STUB ONLY — NOT YET SPEC'D.** This folder records a tracked dependency. No spec/plan/tasks have been authored; no `/speckit-specify` has been run. Created 2026-06-13 from the resolution of [017 Fork 2](../017-offline-pin-reanchor/UNBLOCK-PLAN.md).

## Why this exists

017 (offline-PIN re-anchor) re-keys `cashier_pin_records` onto the provider-neutral `user_id`. The investigation behind [`017/UNBLOCK-PLAN.md`](../017-offline-pin-reanchor/UNBLOCK-PLAN.md) found that **POS has no cashier-PIN provisioning (row-create) path at all** — it is deferred 004-operator-session MVP scope:

- No `INSERT INTO cashier_pin_records` exists anywhere in `src/` or tests.
- `resetCashierPin` refuses on a missing row **by design** (`src/main/operator/pin-management.ts:151`).
- The 004 `data-model.md`/`quickstart.md` "provision via `cashier.pin.reset`" language is **aspirational/inaccurate** — the create path was never built.

**Owner decision (2026-06-13, 017 Fork 2):** this provisioning work is a **004 follow-up feature (this, 019)**, NOT part of 017 (P16 — 017 re-anchors an existing store; it does not build the missing feature).

## Scope (when spec'd)

Build the cashier-PIN provisioning / row-create path such that **the row is keyed on the DP-2-delivered cashier `user_id` from creation** — so 017's migration `0035` is only ever a safety-net for legacy rows, never the primary re-key mechanism. Likely also: correct the stale 004 `data-model.md`/`quickstart.md` "provision via reset" language.

## Dependencies

- **Upstream (held, Fork 1):** DP-2 must surface the cashier's `user_id` on `PosRosterCashierEntry` (verified ~4-line add, **no** provisioning needed — see [`017/OUTBOX-DP2-cashier-user_id.md`](../017-offline-pin-reanchor/OUTBOX-DP2-cashier-user_id.md)). Per Fork 1, that DP-2 slice is spec'd **after** 019 exists, so they land coordinated.
- **Downstream:** unblocks 017 Step 3 (the re-anchor itself).

## Sequence

This is **Step 2 of the 2→1→3 plan** and the **current critical-path head**. Next action: run `/speckit-specify` here when ready to start.

## Evidence

Full investigation + cross-repo proof: [`017/BLOCKER.md`](../017-offline-pin-reanchor/BLOCKER.md) rev. 3 + [`017/UNBLOCK-PLAN.md`](../017-offline-pin-reanchor/UNBLOCK-PLAN.md).

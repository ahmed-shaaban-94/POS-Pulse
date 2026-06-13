# Quickstart — Cashier-PIN Provisioning (019)

Developer path for implementing + exercising the feature.

## What this feature adds

The missing **create** path for `cashier_pin_records`. Today the terminal can only *reset* an existing PIN; 019 lets a manager/admin issue a cashier's *first* PIN — born keyed on the provider-neutral `user_id`.

## Implementation order (test-first)

1. **S1 contract+DTO** — add `ProvisionCashierPinRequest`/`Response` + the `operator.provisionCashierPin` channel to `bridge-api.ts`, preload, and IPC registration. RED: bridge-contract test asserts the channel + DTO shape.
2. **S2 migration (additive column)** — additive `user_id TEXT` (nullable, non-key) on `cashier_pin_records` (R-1). RED: migration test asserts the column exists, idempotent re-run.
3. **S2 handler** — `provisionCashierPin` in `pin-management.ts`. RED tests first:
   - success: manager + rostered cashier with `user_id` → row created keyed on `user_id`, `clerk_user_id` also populated, sealed, audit emitted.
   - role-gate: cashier operator → `role_mismatch`.
   - create-only: existing row (clerk-keyed legacy OR neutral) → `state_invalid`.
   - not-ready: roster entry without `user_id` → `not_ready`, no row.
   - secret-free: PIN/hash/salt absent from audit + response + logs.
4. **S3 roster allowlist** — widen `roster-handler.ts` to carry optional `user_id`. RED: allowlist test asserts `user_id` passes through when present, path still works when absent.
5. **S4 audit category** — `cashier.pin.provisioned` + payload. RED: redaction test extended.
6. **S5 doc-fix** — correct 004 `data-model.md`/`quickstart.md` "provision via reset" language.
7. **S6 §A4** — bridge-security review for the new channel.

## Manual smoke (once DP-2 roster `user_id` is live)

1. Sign in as a manager on a paired terminal.
2. Open cashier management; pick a rostered cashier with **no** PIN on this terminal.
3. Provision an initial PIN → expect `pin_provisioned`.
4. Inspect the row: `user_id` populated (neutral), sealed hash/salt, `failed_attempt_count = 0`.
5. Sign out; sign in as that cashier with the PIN → unlock succeeds **offline**.
6. Try to provision the same cashier again → `state_invalid` (directs to reset).
7. Pick a cashier with no roster `user_id` (pre-DP-2 / unmapped) → `not_ready`, no row.
8. Verify logs + the `cashier.pin.provisioned` audit event contain **no** PIN/hash/salt.

## Pre-DP-2 behavior (held dependency)

Until DP-2 surfaces `user_id` on the roster, every provisioning attempt returns `not_ready` — correct and truthful. Unit tests use a fixture roster carrying `user_id` to exercise the full create path now.

## Guardrails

- `pin-credential.ts` / `pin-lockout.ts` (the verifier) **must not change** — a CI/test guard fails if they gain an identity parameter (FR-8).
- No PIN material crosses the bridge upward or reaches any log (FR-6 / P7).

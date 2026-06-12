# §A4 Bridge-Security Re-Check — 016 D5/D7 (Operator Envelope Adoption)

**Feature:** 016-operator-envelope-adoption (D5 + D7)
**Gate:** §A4 (P8 bridge-security / P7 secret-handling)
**Constitution version pinned:** v1.5.1
**Date:** 2026-06-13
**Status:** CONFIRMATION (not a new review). 016 touches **no** bridge channel, no
preload, no `bridge-api.ts`. This carries forward the 010/011-era §A4 pattern and
re-verifies the invariants against the wired path after the credential swap.

---

## What changed (all under `src/main/**`)

| Site | Change | Credential |
|:--|:--|:--|
| `operator/backend-client.ts` | C-1: interpreter preserves `pos_operator_envelope` (`string\|null\|absent`; other → `refused`) | opaque envelope, in-process |
| `operator/sign-in-handler.ts` L171 | C-1b: holder stores `backend.pos_operator_envelope ?? ''` (was `exchange.jwt`) | envelope, in-process holder |
| `operator/takeover-handler.ts` L203 | C-2: holder stores `backendResult.pos_operator_envelope ?? ''` (was `proto.jwt ?? ''`) | envelope, in-process holder |
| `sales-sync/sale-sync-engine.ts` | M-1: envelope-present gate pauses on `null` **and** `''` | n/a (gate) |
| `sales-sync/create-sale-sync-client.ts` | D5: `Authorization: Bearer <envelope>`; D7: `X-Device-Attestation` retired, dep removed | envelope on header only |
| `index.ts` L1262–1272 | D7: removed `getDeviceAttestation` binding + `pairedDeviceAttestation` capture | n/a |

## Invariants re-verified against the wired path

1. **Envelope never crosses the bridge (P7/P8).** The envelope is read in-process only,
   through the `getOperatorToken` closures (`index.ts` L1266–1269 sale-sync client;
   L1279–1282 engine), each delegating to `operatorJwtHolder.get(sess.backend_session_id)`.
   No bridge channel, preload entry, or `bridge-api.ts` type was added or changed. The
   read-only `sales:syncStatus` channel returns counts + a timestamp only — re-pinned by
   `src/main/ipc/__tests__/sales-sync.test.ts` T050 (response carries no `token`/`bearer`/
   `operator`/`envelope`/`authorization`/`jwt`/`secret`/`credential` substring; single read
   channel, no write/trigger handler).
2. **Opaque, never parsed (G7).** The envelope is treated as an unstructured `string`
   secret — the interpreter validates only `string|null|absent`; no claim is read. No
   Clerk-specific field/scheme/name leaks into the sale-sync auth path post-adoption.
3. **Never logged (P7).** The credential rides the same closure-bound holder + the existing
   `pino` redaction list (`jwt`/`authorization`/`session_token`). Outcome logs carry only
   `sale_id`/`status`/`category`.
4. **Never in the body (P7).** Bearer header only; the request-shape test asserts the
   envelope substring does not appear in the POST body.
5. **`X-Device-Attestation` gone from the sale wire (D7).** Asserted ABSENT in the
   request-shape test; the dep is removed at the type, destructure, refusal-block, and
   composition-root binding — typecheck-meaningful (M-2 single atomic change).
6. **Device-token-alone is impossible (Principle VIII / 028 §18 / CM-2).** With the
   attestation header retired and the M-1 envelope-present gate in force, a present device
   token with an absent envelope (`null` or `''`) pauses the drain — no POST leaves.
   Pinned by `sale-sync-engine.test.ts` T043 (both `null` and `''`).

## Residual / carry-forward

- **Final `refresh`-style re-check** is not applicable to 016 (no `catalogue:refresh`
  analogue here; 016 adds no channel).
- **Live HTTP end-to-end** (a real DP-2 #559 envelope on the wire) is a rollout-time
  verification under §A5 — the unit seam is fully covered.
- **Cashier-envelope gap (T051):** no acquisition point exists in POS today (cashier
  sign-in/takeover are local-only, AD-2). Governed by OQ-CARRY; does NOT affect the
  manager/admin D5/D7 path.

**Disposition:** §A4 invariants HOLD after the D5/D7 swap. Confirmation recorded.

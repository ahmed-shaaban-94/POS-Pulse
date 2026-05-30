# Observability slice — redaction card/voucher surface + scrubber source-of-truth unification

**Date:** 2026-05-30
**Branch:** `obs/redaction-card-voucher-surface` (standalone — NOT 008)
**Resolves:** 008 §A5 T522 case-(b) BLOCK (see `specs/008-sale-finalization-and-receipts/a5-verification-findings.md`)

## Problem

T522's audit found that the full AD-9 forbidden-field surface
(`data-model.md §"Forbidden fields"`) is NOT covered by the application's
log/telemetry scrubbers. Seven fields are covered by **neither** layer —
`track1`, `track2`, `cryptogram`, `issuer_name`, `receipt_text`,
`voucher_code`, `voucher_balance` — and several more are covered only by an
incidental substring match in Sentry, not by the pino exact-key redactor.

**Root cause: source-of-truth drift.** `src/shared/audit/forbidden-keys.ts`
documents itself as the single source of truth consumed by three layers
(audit-emitter refusal, pino `redact`, both Sentry `beforeSend` scrubbers).
In reality only pino imports the list. Both Sentry scrubbers use a
hand-maintained `DENYLIST_PATTERN` regex that drifted from the list — which is
exactly how these fields slipped through.

## Goal

Make `FORBIDDEN_PAYLOAD_KEYS` the **complete** AD-9 redaction surface and the
**actual** single source of truth for all three layers, so a future field
added in one place propagates everywhere automatically.

## Constitution / boundary constraints

- **§P11** — scrubber extensions MUST NOT be smuggled into a non-observability
  feature. This is its own observability slice on a non-008 branch. 008 only
  *cites* it as the T522 resolution.
- **no-jwt-in-renderer-or-preload guard** (`src/renderer/__tests__/no-jwt-in-renderer-or-preload.test.ts`)
  — forbids `jwt`/`clerk_jwt`/`clerk_session_token`/`Bearer`/`Authorization`
  *literals* in renderer/preload source. The renderer Sentry scrubber may
  `import { FORBIDDEN_PAYLOAD_KEYS }` (symbol only; the literals live in
  `shared/`, outside the guard's scan roots) but MUST NOT inline those values.
  Verified: the guard `readFileSync`-greps file text, and an import line
  contains only the symbol name.
- **Append-only** — `FORBIDDEN_PAYLOAD_KEYS` MUST NOT shrink. Adding strictly
  tightens redaction.

## Changes

### 1. `src/shared/audit/forbidden-keys.ts` — extend to the full AD-9 surface
Append (append-only) the complete card/voucher/credential/envelope surface
from `data-model.md §"Forbidden fields"`:

- **Card:** `pan`, `card_pan`, `truncated_pan`, `cvv`, `track_data`, `track1`,
  `track2`, `cardholder_name`, `cardholder`, `holder_name`, `expiry`,
  `expiration`, `issuer_name`, `auth_payload`, `approval_code`, `cryptogram`,
  `terminal_receipt_text`, `receipt_text`
- **Voucher:** `voucher_code`, `voucher_balance`, `voucher_holder`,
  `voucher_holder_pii`, `voucher_redemption_intent_token`,
  `redemption_intent_token`, `intent_token`, `authority_payload`,
  `authority_response`, `raw_voucher_authority_response`
- **Credential (new explicit names):** `jwt`, `attestation`, `pin_record_id`
  (the list already has `pin`, `pin_hash`, `password`, `device_token`,
  `clerk_jwt`, etc.)
- **Envelope:** `envelope_payload`, `raw_envelope`, `payment_intent_envelope`

Existing keys stay. Dedupe is not required (the list is a set in spirit; the
matcher dedupes by behaviour) but we avoid literal duplicates.

### 2. Sentry scrubbers — derive the matcher from the shared list
`src/main/observability/sentry-main.ts` and
`src/renderer/observability/sentry-renderer.ts`: replace the hand-maintained
`DENYLIST_PATTERN` with a matcher **derived from `FORBIDDEN_PAYLOAD_KEYS`**,
preserving today's **case-insensitive substring** semantics (a key is stripped
if it contains any forbidden term as a substring).

- A shared helper (e.g. `isForbiddenKey(key: string): boolean` in
  `shared/audit/forbidden-keys.ts`) keeps the matching logic in one place and
  reachable by both processes.

> **Matching-semantics invariant (do NOT unify the matchers).** The three
> consumers match differently and MUST keep doing so:
> - **audit-emitter** (`findForbiddenKey`) — **exact** `Array.includes(key)`.
> - **pino** (`REDACTION_PATHS`) — **exact key** at wildcard depths.
> - **Sentry** (`DENYLIST_PATTERN`) — **case-insensitive substring**.
>
> The new `isForbiddenKey` helper carries **Sentry substring** semantics and is
> consumed by the two Sentry scrubbers ONLY. The audit-emitter and pino keep
> their existing exact-match consumption of the raw list — they simply gain
> more entries. Routing the emitter/pino through the substring helper would
> silently broaden refusal/redaction (exact→substring), which is out of scope
> and unreviewed. Verified blast radius: no legitimate `src/main` audit payload
> uses any newly-added key name, so the (exact-match) emitter refusal does not
> break existing audit emission.
- **Preserve the extra hand-terms** that are NOT in the list but are scrubbed
  today: `email`, `phone`. Fold them into a small explicit supplement
  (`SUPPLEMENTAL_SENTRY_DENY_TERMS = ['email', 'phone']`) so nothing currently
  scrubbed is dropped. (These are PII-shaped terms appropriate for Sentry's
  broader denylist but not part of the audit-payload forbidden set.)
- Renderer keeps its `import`-only posture (no inlined literals).

### 3. Tests (TDD — written first)
- **Coverage test:** every field in the full AD-9 surface is (a) stripped by
  `scrubEvent` (main), (b) stripped by `scrubRendererEvent` (renderer),
  (c) present in the pino `REDACTION_PATHS`.
- **Drift-regression test:** the Sentry matcher is derived from
  `FORBIDDEN_PAYLOAD_KEYS` — assert that a key added to the list is scrubbed by
  both scrubbers without any change to the Sentry files. This is the guard that
  prevents the drift from silently returning.
- **Supplement test:** `email` / `phone` still stripped (no regression).
- **no-jwt guard:** stays green (renderer imports symbol, no inlined literals).

### 4. 008 §A5 findings doc — flip T522
After this slice merges, update
`specs/008-sale-finalization-and-receipts/a5-verification-findings.md`:
T522 BLOCK → "Resolved via observability slice `obs/redaction-card-voucher-surface`
(PR #NN)". (Separate commit/PR; not part of this slice's diff to keep §P11 clean.)

## Components / data flow

```
shared/audit/forbidden-keys.ts
  ├─ FORBIDDEN_PAYLOAD_KEYS  (the complete AD-9 surface, append-only)
  └─ isForbiddenKey(key)     (case-insensitive substring matcher)
        │
        ├─→ main/audit/audit-emitter.ts   (refusal — unchanged behaviour)
        ├─→ main/logging/logger.ts        (pino redact paths — already consumes list)
        ├─→ main/observability/sentry-main.ts      (beforeSend — now derives from list)
        └─→ renderer/observability/sentry-renderer.ts (beforeSend — now derives from list)
```

## Testing

Vitest only. New tests live beside the scrubbers
(`src/main/observability/__tests__/`, `src/renderer/observability/__tests__/`)
and the shared list (`src/shared/audit/__tests__/`). Existing scrubber +
redaction + no-jwt-guard tests MUST stay green. Coverage: the observability
files are already in the §A5 floor set; keep them ≥ their current levels.

## Out of scope / Not in this slice
- No change to the audit-emitter's refusal behaviour (it already consumes the
  list; new keys tighten it, which is correct and desired).
- No 008 feature-code change.
- No edit to the `no-jwt` guard itself.
- The T522 doc flip is a follow-up commit, not part of this slice's source diff.

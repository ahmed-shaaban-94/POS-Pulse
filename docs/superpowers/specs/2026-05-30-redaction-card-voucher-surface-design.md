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

### 2. Sentry scrubbers — derive the matcher from the shared list (EXACT-key, not substring)
`src/main/observability/sentry-main.ts` and
`src/renderer/observability/sentry-renderer.ts`: replace the hand-maintained
`DENYLIST_PATTERN` substring regex with a matcher **derived from
`FORBIDDEN_PAYLOAD_KEYS`** using **case-insensitive EXACT-key** matching (the
key, lower-cased, must equal a list entry), PLUS a short curated substring
supplement (below).

**Why exact, not substring (review finding):** if the full AD-9 surface were fed
through a *substring* matcher, adding broad new terms like `authority` or
`intent_token` would newly over-scrub legitimate, non-secret keys —
`voucher_authority_redemption_id` (the ALLOWED, printed field —
`template-engine.ts:203`; `data-model.md:81`) and the `intent_token_*` /
`authority_unreachable` error-reason codes. Exact-key matching of the named
surface avoids introducing any such new over-scrub, covers every *named*
forbidden field precisely, and makes all three layers consistently EXACT.

> **Pre-existing limitation (NOT introduced or fixed by this slice).** Today's
> `DENYLIST_PATTERN` regex ALREADY strips those keys from Sentry via its
> existing broad terms (`auth` matches `voucher_authority_redemption_id` and
> `authority_unreachable`; `token` matches `intent_token_*`). That over-scrub of
> the printed voucher ref + diagnostic reason codes is a current behaviour. This
> slice keeps the supplement **frozen to today's exact term set**, so it neither
> introduces nor removes that behaviour — it stays purely additive. Narrowing
> the scrubber to stop over-scrubbing those keys would REDUCE redaction (a
> security-sensitive change in the opposite direction) and is explicitly OUT OF
> SCOPE here; flag it as a separate follow-up if desired.

- A shared helper in `shared/audit/forbidden-keys.ts`:
  `isForbiddenSentryKey(key: string): boolean` — returns true if
  `key.toLowerCase()` exactly equals any `FORBIDDEN_PAYLOAD_KEYS` entry
  (lower-cased), OR contains any `SUPPLEMENTAL_SENTRY_SUBSTRING_TERMS` entry as
  a substring (case-insensitive). One helper, both processes.

- **Curated substring supplement** — preserves the genuinely-want-substring
  breadth the current Sentry regex has, kept SHORT and deliberate (not the full
  surface):
  `SUPPLEMENTAL_SENTRY_SUBSTRING_TERMS = ['secret', 'token', 'password', 'credential', 'card', 'pan', 'cvv', 'email', 'phone', 'pin', 'jwt', 'clerk', 'auth', 'pair']`
  — i.e. exactly the terms in today's `DENYLIST_PATTERN`. This means the slice
  is **purely additive to Sentry**: every key the old regex caught is still
  caught (via the supplement), plus the newly-named exact fields. No legitimate
  key that passes today starts getting scrubbed.
  - NB: `auth` as a substring matches `authority_unreachable` etc. TODAY too —
    this is pre-existing behaviour the slice does not change. The blocking
    finding is specifically about NOT *adding* `authority` / `intent_token` as
    new substring terms. The supplement is frozen to the current term set.

> **Matching-semantics invariant (do NOT unify onto substring).** The three
> consumers match differently and MUST keep doing so:
> - **audit-emitter** (`findForbiddenKey`) — **exact** `Array.includes(key)`.
> - **pino** (`REDACTION_PATHS`) — **exact key** at wildcard depths.
> - **Sentry** (`isForbiddenSentryKey`) — **exact key (case-insensitive)** ∪
>   the frozen curated substring supplement.
>
> The emitter and pino keep consuming the raw list with their existing exact
> semantics — they simply gain more entries. They do NOT consume
> `isForbiddenSentryKey` (which adds the substring supplement). Verified blast
> radius: no legitimate `src/main` audit payload uses any newly-added key name,
> so the (exact-match) emitter refusal does not break existing audit emission.
- Renderer keeps its `import`-only posture (no inlined literals).

### 3. Tests (TDD — written first)
- **Coverage test:** every field in the full AD-9 surface is (a) stripped by
  `scrubEvent` (main), (b) stripped by `scrubRendererEvent` (renderer),
  (c) present in the pino `REDACTION_PATHS`.
- **Drift-regression test:** the Sentry matcher is derived from
  `FORBIDDEN_PAYLOAD_KEYS` — assert that a key added to the list is scrubbed by
  both scrubbers without any change to the Sentry files. This is the guard that
  prevents the drift from silently returning.
- **Purely-additive test (the review finding):** assert the slice does not
  CHANGE any key's current Sentry disposition — for a representative set
  (including `voucher_authority_redemption_id`, `authority_unreachable`,
  `intent_token_expired`), the new `isForbiddenSentryKey` returns the SAME
  verdict as today's `DENYLIST_PATTERN`. (These remain scrubbed — pre-existing
  behaviour; see the limitation note in §2.) This locks in "additive only" and
  fails loudly if anyone broadens to substring on the full surface or narrows
  the supplement.
- **Net-new coverage test:** the genuinely-uncovered fields
  (`track1`, `track2`, `cryptogram`, `issuer_name`, `receipt_text`,
  `voucher_code`, `voucher_balance`) pass today's regex but ARE scrubbed by
  `isForbiddenSentryKey` (via exact-key match). This is the actual T522 fix.
- **Supplement test:** the frozen substring terms still strip
  (`email`/`phone`/`cardReaderId`-style), so no key the old regex caught is missed.
- **no-jwt guard:** stays green (renderer imports symbol, no inlined literals).

### 4. 008 §A5 findings doc — flip T522
After this slice merges, update
`specs/008-sale-finalization-and-receipts/a5-verification-findings.md`:
T522 BLOCK → "Resolved via observability slice `obs/redaction-card-voucher-surface`
(PR #NN)". (Separate commit/PR; not part of this slice's diff to keep §P11 clean.)

## Components / data flow

```
shared/audit/forbidden-keys.ts
  ├─ FORBIDDEN_PAYLOAD_KEYS              (the complete AD-9 surface, append-only)
  ├─ SUPPLEMENTAL_SENTRY_SUBSTRING_TERMS (frozen = today's regex terms)
  └─ isForbiddenSentryKey(key)          (exact-key ci ∪ curated substring)
        │
        ├─ FORBIDDEN_PAYLOAD_KEYS (raw, EXACT) ─→ main/audit/audit-emitter.ts   (refusal — unchanged)
        ├─ FORBIDDEN_PAYLOAD_KEYS (raw, EXACT) ─→ main/logging/logger.ts        (pino redact paths)
        ├─ isForbiddenSentryKey ──────────────→ main/observability/sentry-main.ts      (beforeSend)
        └─ isForbiddenSentryKey ──────────────→ renderer/observability/sentry-renderer.ts (beforeSend)
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

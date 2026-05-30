# Redaction Card/Voucher Surface Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `FORBIDDEN_PAYLOAD_KEYS` the complete AD-9 redaction surface and the actual single source of truth for all three scrubbing layers (audit-emitter, pino, both Sentry scrubbers), closing the T522 gap.

**Architecture:** Append the full AD-9 forbidden-field surface to the shared list (append-only). Replace the two hand-maintained Sentry `DENYLIST_PATTERN` substring regexes with a shared `isForbiddenSentryKey(key)` helper that matches case-insensitive EXACT-key against the list ∪ a frozen curated substring supplement (= today's regex terms). The audit-emitter and pino keep their existing EXACT-match consumption of the raw list unchanged.

**Tech Stack:** TypeScript (strict), Vitest, `@sentry/electron` (main + renderer), pino.

**Design ref:** `docs/superpowers/specs/2026-05-30-redaction-card-voucher-surface-design.md`

---

## File Structure

- **Modify** `src/shared/audit/forbidden-keys.ts` — extend `FORBIDDEN_PAYLOAD_KEYS` to the full AD-9 surface; add `SUPPLEMENTAL_SENTRY_SUBSTRING_TERMS` + `isForbiddenSentryKey()`.
- **Modify** `src/main/observability/sentry-main.ts` — replace `DENYLIST_PATTERN` regex usage with `isForbiddenSentryKey`.
- **Modify** `src/renderer/observability/sentry-renderer.ts` — same, import-only (no inlined literals).
- **Create** `src/shared/audit/__tests__/forbidden-keys-sentry-matcher.test.ts` — unit tests for the new helper (exact-key, supplement, additive-parity, net-new coverage).
- **Existing tests that auto-extend (must stay green):** `src/main/observability/__tests__/sentry-main-audit-redaction.test.ts`, `src/renderer/observability/__tests__/sentry-renderer-audit-redaction.test.ts`, `src/main/logging/__tests__/logger-audit-redaction.test.ts` (all iterate `FORBIDDEN_PAYLOAD_KEYS`), plus `src/renderer/__tests__/no-jwt-in-renderer-or-preload.test.ts`.

---

## Task 1: Add the matcher helper to the shared list (TDD)

**Files:**
- Modify: `src/shared/audit/forbidden-keys.ts`
- Test: `src/shared/audit/__tests__/forbidden-keys-sentry-matcher.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/shared/audit/__tests__/forbidden-keys-sentry-matcher.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  FORBIDDEN_PAYLOAD_KEYS,
  SUPPLEMENTAL_SENTRY_SUBSTRING_TERMS,
  isForbiddenSentryKey,
} from '../forbidden-keys.js';

// The exact substring terms the pre-T522 Sentry DENYLIST_PATTERN used. The
// supplement MUST stay frozen to this set so the slice is purely additive.
const LEGACY_REGEX =
  /secret|token|password|credential|card|pii|cvv|pan|email|phone|pin|jwt|clerk|auth|pair/i;

describe('isForbiddenSentryKey — exact-key coverage of the forbidden surface', () => {
  for (const key of FORBIDDEN_PAYLOAD_KEYS) {
    it(`matches exact forbidden key '${key}' (and its upper-case form)`, () => {
      expect(isForbiddenSentryKey(key)).toBe(true);
      expect(isForbiddenSentryKey(key.toUpperCase())).toBe(true);
    });
  }
});

describe('isForbiddenSentryKey — curated substring supplement', () => {
  for (const term of SUPPLEMENTAL_SENTRY_SUBSTRING_TERMS) {
    it(`matches a key containing supplement term '${term}'`, () => {
      expect(isForbiddenSentryKey(`x_${term}_y`)).toBe(true);
    });
  }

  it('keeps the cardReaderId-style substring breadth (card)', () => {
    expect(isForbiddenSentryKey('cardReaderId')).toBe(true);
  });
});

describe('isForbiddenSentryKey — purely additive vs legacy regex', () => {
  // Every key the old regex caught must still be caught (additive only).
  const sampleKeys = [
    'apiToken', 'userPassword', 'cardReaderId', 'customerPhone', 'authHeader',
    'voucher_authority_redemption_id', 'authority_unreachable', 'intent_token_expired',
    'pairing_code', 'clerk_jwt', 'cvv', 'pan', 'someEmail',
  ];
  for (const key of sampleKeys) {
    it(`'${key}': new matcher is at least as strict as legacy regex`, () => {
      if (LEGACY_REGEX.test(key)) {
        expect(isForbiddenSentryKey(key)).toBe(true);
      }
    });
  }
});

describe('isForbiddenSentryKey — net-new coverage (the T522 fix)', () => {
  // These pass the legacy regex but are the genuinely-uncovered fields.
  const netNew = ['track1', 'track2', 'cryptogram', 'issuer_name', 'receipt_text', 'voucher_code', 'voucher_balance'];
  for (const key of netNew) {
    it(`now scrubs previously-uncovered field '${key}'`, () => {
      expect(LEGACY_REGEX.test(key)).toBe(false); // confirms it was a real gap
      expect(isForbiddenSentryKey(key)).toBe(true);
    });
  }

  it('does not match a clearly-benign key', () => {
    expect(isForbiddenSentryKey('shift_id')).toBe(false);
    expect(isForbiddenSentryKey('annotation')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/shared/audit/__tests__/forbidden-keys-sentry-matcher.test.ts`
Expected: FAIL — `SUPPLEMENTAL_SENTRY_SUBSTRING_TERMS` / `isForbiddenSentryKey` not exported; and the net-new fields not yet in `FORBIDDEN_PAYLOAD_KEYS`.

- [ ] **Step 3: Extend the list + add the helper**

In `src/shared/audit/forbidden-keys.ts`, replace the `FORBIDDEN_PAYLOAD_KEYS` array (currently lines 34–47) and append the helper. The list becomes (existing 12 keys first, then the AD-9 groups; no literal duplicates):

```typescript
export const FORBIDDEN_PAYLOAD_KEYS = [
  // — Credential / auth (002 + 004 pre-existing) —
  'pin',
  'pin_hash',
  'password',
  'password_hash',
  'clerk_jwt',
  'clerk_session_token',
  'device_token',
  'device_token_attestation',
  'pairing_code',
  'token',
  'secret',
  'credential',
  // — Credential / auth (008 AD-9 explicit names; data-model.md §Forbidden fields FR-072) —
  'jwt',
  'attestation',
  'pin_record_id',
  // — Card surface (FR-070) —
  'pan',
  'card_pan',
  'truncated_pan',
  'cvv',
  'track_data',
  'track1',
  'track2',
  'cardholder_name',
  'cardholder',
  'holder_name',
  'expiry',
  'expiration',
  'issuer_name',
  'auth_payload',
  'approval_code',
  'cryptogram',
  'terminal_receipt_text',
  'receipt_text',
  // — Voucher surface (FR-071) —
  'voucher_code',
  'voucher_balance',
  'voucher_holder',
  'voucher_holder_pii',
  'voucher_redemption_intent_token',
  'redemption_intent_token',
  'intent_token',
  'authority_payload',
  'authority_response',
  'raw_voucher_authority_response',
  // — Envelope (FR-074; only envelope_handoff_action_id is permitted) —
  'envelope_payload',
  'raw_envelope',
  'payment_intent_envelope',
] as const satisfies readonly string[];

export type ForbiddenPayloadKey = (typeof FORBIDDEN_PAYLOAD_KEYS)[number];

/**
 * T522 — curated substring terms for the Sentry scrubbers ONLY.
 *
 * Frozen to the exact term set the pre-T522 `DENYLIST_PATTERN` regex used, so
 * `isForbiddenSentryKey` is PURELY ADDITIVE to Sentry: every key the old regex
 * caught is still caught, plus the newly-named exact fields above. Do NOT add
 * broad new terms here (e.g. `authority`, `intent_token`) — substring breadth
 * over the full surface over-scrubs legitimate diagnostic/allowed keys
 * (see the design doc §2 "Pre-existing limitation").
 */
export const SUPPLEMENTAL_SENTRY_SUBSTRING_TERMS = [
  'secret',
  'token',
  'password',
  'credential',
  'card',
  'pii',
  'cvv',
  'pan',
  'email',
  'phone',
  'pin',
  'jwt',
  'clerk',
  'auth',
  'pair',
] as const satisfies readonly string[];

/**
 * Sentry-scrubber key matcher (defence-in-depth telemetry redaction).
 *
 * Returns true if `key` (case-insensitively) EXACTLY equals a
 * `FORBIDDEN_PAYLOAD_KEYS` entry, OR contains a
 * `SUPPLEMENTAL_SENTRY_SUBSTRING_TERMS` term as a substring.
 *
 * Sentry ONLY. The audit-emitter and pino consume `FORBIDDEN_PAYLOAD_KEYS`
 * directly with their own EXACT-match semantics; they MUST NOT route through
 * this helper (it adds substring breadth they do not want).
 */
export function isForbiddenSentryKey(key: string): boolean {
  const lower = key.toLowerCase();
  for (const k of FORBIDDEN_PAYLOAD_KEYS) {
    if (lower === k.toLowerCase()) return true;
  }
  for (const term of SUPPLEMENTAL_SENTRY_SUBSTRING_TERMS) {
    if (lower.includes(term)) return true;
  }
  return false;
}
```

Also update the file's header doc-comment (lines 9–28) so it no longer claims the Sentry layers consume the list literally — change the layer-3 bullet to: *"extend the `beforeSend` denylist via `isForbiddenSentryKey` (exact-key ∪ curated substring supplement)."*

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/shared/audit/__tests__/forbidden-keys-sentry-matcher.test.ts`
Expected: PASS (all describe blocks green).

- [ ] **Step 5: Commit**

```bash
git add src/shared/audit/forbidden-keys.ts src/shared/audit/__tests__/forbidden-keys-sentry-matcher.test.ts
git commit -m "feat(obs): extend forbidden-keys to full AD-9 surface + isForbiddenSentryKey helper"
```

---

## Task 2: Wire main-process Sentry scrubber to the helper (TDD)

**Files:**
- Modify: `src/main/observability/sentry-main.ts` (lines 124–125, 218)
- Test: `src/main/observability/__tests__/sentry-main-audit-redaction.test.ts` (existing — auto-extends via `FORBIDDEN_PAYLOAD_KEYS` loop)

- [ ] **Step 1: Run the existing redaction test to see it fail on the new keys**

The existing test iterates `FORBIDDEN_PAYLOAD_KEYS`; Task 1 added new keys (e.g. `track1`, `receipt_text`) that the current `DENYLIST_PATTERN` regex does NOT match.

Run: `npx vitest run src/main/observability/__tests__/sentry-main-audit-redaction.test.ts`
Expected: FAIL — e.g. `strips top-level extra key 'track1'` fails (regex misses it).

- [ ] **Step 2: Replace the regex with the shared helper**

In `src/main/observability/sentry-main.ts`:

Replace the import region near the top to add the helper (the file currently has no import from forbidden-keys — add one):

```typescript
import { isForbiddenSentryKey } from '../../shared/audit/forbidden-keys.js';
```

Delete the `DENYLIST_PATTERN` constant (lines 124–125) and its preceding doc-comment block (lines 93–123 describe the regex; replace with a short comment pointing at the shared helper). Then change the strip check (line 218):

```typescript
// before:  if (DENYLIST_PATTERN.test(key)) continue;
if (isForbiddenSentryKey(key)) continue;
```

Replacement doc-comment above `stripDenylistedKeys` (where the old block was):

```typescript
/**
 * Key denylist for Sentry scrubbing lives in the shared single source of
 * truth: `isForbiddenSentryKey` (exact-key over FORBIDDEN_PAYLOAD_KEYS ∪ the
 * frozen curated substring supplement). See shared/audit/forbidden-keys.ts.
 */
```

- [ ] **Step 3: Run the existing redaction test to verify it passes**

Run: `npx vitest run src/main/observability/__tests__/sentry-main-audit-redaction.test.ts`
Expected: PASS — every `FORBIDDEN_PAYLOAD_KEYS` entry (including new ones) stripped.

- [ ] **Step 4: Run the baseline sentry-main test to confirm no regression**

Run: `npx vitest run src/main/observability/__tests__/sentry-main.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/observability/sentry-main.ts
git commit -m "feat(obs): main Sentry scrubber derives denylist from shared source of truth"
```

---

## Task 3: Wire renderer-process Sentry scrubber to the helper (TDD)

**Files:**
- Modify: `src/renderer/observability/sentry-renderer.ts` (lines 120–121, 181)
- Test: `src/renderer/observability/__tests__/sentry-renderer-audit-redaction.test.ts` (existing — auto-extends)

- [ ] **Step 1: Run the existing renderer redaction test to see it fail**

Run: `npx vitest run src/renderer/observability/__tests__/sentry-renderer-audit-redaction.test.ts`
Expected: FAIL on new keys (e.g. `voucher_code`).

- [ ] **Step 2: Replace the regex with the shared helper (import-only — no inlined literals)**

In `src/renderer/observability/sentry-renderer.ts`, add the import:

```typescript
import { isForbiddenSentryKey } from '../../shared/audit/forbidden-keys.js';
```

Delete the `DENYLIST_PATTERN` constant (lines 120–121) and its doc-comment (lines ~93–119). Change the strip check (line 181):

```typescript
// before:  if (DENYLIST_PATTERN.test(key)) continue;
if (isForbiddenSentryKey(key)) continue;
```

> CRITICAL (no-jwt guard): do NOT inline any forbidden literal (`jwt`, `clerk_jwt`, `clerk_session_token`, `Bearer`, `Authorization`) into this renderer file. The import line carries only the symbol `isForbiddenSentryKey`; the literals stay in `shared/`. Removing the old `JWT`/`clerk`/`auth` regex terms from this file is fine (they move into the shared list/supplement).

- [ ] **Step 3: Run the existing renderer redaction test to verify it passes**

Run: `npx vitest run src/renderer/observability/__tests__/sentry-renderer-audit-redaction.test.ts`
Expected: PASS.

- [ ] **Step 4: Run the no-jwt guard + baseline renderer test**

Run: `npx vitest run src/renderer/__tests__/no-jwt-in-renderer-or-preload.test.ts src/renderer/observability/__tests__/sentry-renderer.test.ts`
Expected: PASS (both) — confirms no forbidden literal landed in renderer source and baseline scrub still works.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/observability/sentry-renderer.ts
git commit -m "feat(obs): renderer Sentry scrubber derives denylist from shared source of truth"
```

---

## Task 4: Confirm pino auto-coverage + full-suite green

**Files:**
- Verify only (no edits expected): `src/main/logging/logger.ts` already builds `REDACTION_PATHS` from `FORBIDDEN_PAYLOAD_KEYS`, so Task 1's new keys flow in automatically.

- [ ] **Step 1: Run the pino redaction test (auto-extended by the new keys)**

Run: `npx vitest run src/main/logging/__tests__/logger-audit-redaction.test.ts`
Expected: PASS — the test iterates `FORBIDDEN_PAYLOAD_KEYS`; new keys are redacted because `logger.ts` derives `REDACTION_PATHS` from the list. If it FAILS, that means a new key is not flowing into the paths — recheck `logger.ts` `ALL_REDACTED_KEYS` merge (it should pick up `FORBIDDEN_PAYLOAD_KEYS` via `AUDIT_REDACTED_KEYS`).

- [ ] **Step 2: Typecheck + lint**

Run: `npm run typecheck` then `npm run lint`
Expected: both exit 0. (Renderer lint includes the no-jwt vocabulary expectations.)

- [ ] **Step 3: Full test suite**

Run: `npm test`
Expected: PASS — all suites, including the three auto-extended redaction tests, the new matcher test, and the no-jwt guard.

- [ ] **Step 4: Commit (only if any verify-driven fix was needed; else skip)**

```bash
git add -A
git commit -m "test(obs): confirm pino + full-suite green for AD-9 redaction surface"
```

---

## Task 5: Flip 008 §A5 T522 finding (separate commit, §P11-clean)

**Files:**
- Modify: `specs/008-sale-finalization-and-receipts/a5-verification-findings.md`

- [ ] **Step 1: Update the T522 section**

Change the T522 heading + body from "CASE (b): HARD NON-COVERAGE → BLOCK" to RESOLVED, citing this slice. Replace the `## ⚠️ T522 …` heading line with:

```markdown
## ✅ T522 — Sentry/pino scrubber decision tree — **RESOLVED (was case (b))**

Resolved by observability slice `obs/redaction-card-voucher-surface` (PR #NN):
`FORBIDDEN_PAYLOAD_KEYS` extended to the full AD-9 surface and both Sentry
scrubbers + pino now derive from that single source of truth. The seven
previously-uncovered fields (`track1`, `track2`, `cryptogram`, `issuer_name`,
`receipt_text`, `voucher_code`, `voucher_balance`) are now scrubbed by exact-key
match. Verified by the auto-extended `*-audit-redaction.test.ts` suites + the
new `forbidden-keys-sentry-matcher.test.ts`.
```

Update the "Owner must clear" T522 line to mark it resolved. (Replace `#NN` with the actual PR number once opened.)

- [ ] **Step 2: Commit**

```bash
git add specs/008-sale-finalization-and-receipts/a5-verification-findings.md
git commit -m "docs(008): T522 resolved via obs/redaction-card-voucher-surface slice"
```

---

## Notes on scope
- This is a standalone observability slice (§P11-clean): NOT 008 feature code.
- The audit-emitter (`findForbiddenKey`, exact `.includes`) gains coverage of the new keys automatically and correctly (tightens refusal). Verified blast radius: no legitimate `src/main` audit payload uses any newly-added key name.
- Pre-existing Sentry over-scrub of `voucher_authority_redemption_id` + `intent_token_*` reason codes (via legacy `auth`/`token` terms) is unchanged by this slice and explicitly out of scope (narrowing would reduce redaction).

import { describe, it, expect } from 'vitest';
import {
  FORBIDDEN_PAYLOAD_KEYS,
  SUPPLEMENTAL_SENTRY_SUBSTRING_TERMS,
  isForbiddenSentryKey,
} from '../forbidden-keys.js';

/**
 * T522 — unit coverage for the Sentry-scrubber key matcher.
 *
 * The matcher is the single source of truth shared by both Sentry
 * `beforeSend` scrubbers. It matches case-insensitive EXACT-key over
 * `FORBIDDEN_PAYLOAD_KEYS` ∪ a frozen curated substring supplement (the exact
 * terms the pre-T522 `DENYLIST_PATTERN` regex used). The slice is PURELY
 * ADDITIVE to Sentry: every key the old regex caught is still caught, plus the
 * newly-named exact fields.
 *
 * If any assertion fails, tighten the SOURCE — never the test.
 */

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
    'apiToken',
    'userPassword',
    'cardReaderId',
    'customerPhone',
    'authHeader',
    'voucher_authority_redemption_id',
    'authority_unreachable',
    'intent_token_expired',
    'pairing_code',
    'clerk_jwt',
    'cvv',
    'pan',
    'someEmail',
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
  const netNew = [
    'track1',
    'track2',
    'cryptogram',
    'issuer_name',
    'receipt_text',
    'voucher_code',
    'voucher_balance',
  ];
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

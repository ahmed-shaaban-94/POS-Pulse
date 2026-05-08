import { describe, expect, it } from 'vitest';

import { hashPin, verifyPin } from '../../src/main/operator/pin-credential.js';
import type { PinRow } from '../../src/main/operator/pin-credential.js';

/**
 * 004-operator-session T053 — PIN credential PR-1 redaction smoke tests.
 *
 * Verifies that the Argon2id verifier never leaks the input PIN on any
 * observable surface: return values, thrown errors.
 *
 * These are pure-function surface checks — no logger is injected because
 * pin-credential.ts intentionally has no logger (structural PR-1 guarantee).
 * The test therefore only needs to assert that return values and propagated
 * errors are PIN-free.
 *
 * FR-030 / PR-1: PIN never appears in log payloads, error messages, or
 * serialized output of any kind.
 */

const SENTINEL_PIN = 'redact-sentinel-8472';

describe('PR-1 redaction — hashPin', () => {
  it('hashPin return value does not contain the PIN', async () => {
    const result = await hashPin(SENTINEL_PIN);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain(SENTINEL_PIN);
  });
});

describe('PR-1 redaction — verifyPin', () => {
  let validRow: PinRow;

  it('match result does not contain the PIN', async () => {
    const { pin_hash, pin_salt } = await hashPin(SENTINEL_PIN);
    validRow = { pin_hash, pin_salt, failed_attempt_count: 0, lockout_until: null };

    const result = await verifyPin(SENTINEL_PIN, validRow);
    expect(result.kind).toBe('match');
    expect(JSON.stringify(result)).not.toContain(SENTINEL_PIN);
  });

  it('no_match result does not contain the PIN', async () => {
    const { pin_hash, pin_salt } = await hashPin(SENTINEL_PIN);
    const row: PinRow = { pin_hash, pin_salt, failed_attempt_count: 0, lockout_until: null };

    const result = await verifyPin('wrong-pin-00000', row);
    expect(result.kind).toBe('no_match');
    expect(JSON.stringify(result)).not.toContain(SENTINEL_PIN);
    expect(JSON.stringify(result)).not.toContain('wrong-pin-00000');
  });

  it('locked_out result does not contain the PIN', async () => {
    const { pin_hash, pin_salt } = await hashPin(SENTINEL_PIN);
    const future = new Date(Date.now() + 60_000).toISOString();
    const row: PinRow = {
      pin_hash,
      pin_salt,
      failed_attempt_count: 5,
      lockout_until: future,
    };

    const result = await verifyPin(SENTINEL_PIN, row);
    expect(result.kind).toBe('locked_out');
    expect(JSON.stringify(result)).not.toContain(SENTINEL_PIN);
  });

  it('malformed hash error does not contain the PIN', async () => {
    const row: PinRow = {
      pin_hash: 'not-a-valid-phc-hash',
      pin_salt: 'aabbccdd',
      failed_attempt_count: 0,
      lockout_until: null,
    };

    let thrownError: unknown;
    try {
      await verifyPin(SENTINEL_PIN, row);
    } catch (e) {
      thrownError = e;
    }

    expect(thrownError).toBeDefined();
    expect(JSON.stringify(thrownError)).not.toContain(SENTINEL_PIN);
    if (thrownError instanceof Error) {
      expect(thrownError.message).not.toContain(SENTINEL_PIN);
    }
  });
}, 15_000);

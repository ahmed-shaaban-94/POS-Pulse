import { beforeAll, describe, expect, it } from 'vitest';

import { hashPin, verifyPin } from '../../../../src/main/operator/pin-credential.js';
import type { PinRow } from '../../../../src/main/operator/pin-credential.js';

/**
 * 004-operator-session T052 — Argon2id PIN verifier unit tests.
 *
 * Verifies:
 *  - hashPin returns BLOB-compatible Buffer types (schema: BLOB NOT NULL).
 *  - Correct PIN passes verification.
 *  - Wrong PIN fails and increments failed_attempt_count.
 *  - failed_attempt_count increments monotonically per call.
 *  - Lockout triggers when newFailedCount reaches 5; newLockoutUntil is ~5 min out.
 *  - Lockout state persists across simulated restart (lockout_until from DB row).
 *  - Correct PIN during active lockout returns locked_out (lockout check is pre-verify).
 *  - Expired lockout allows verification to proceed.
 *
 * Performance: one hash is computed in beforeAll and reused across all tests.
 * Argon2id at m=64MiB/t=3 takes 50–200ms per hash — shared to keep suite fast.
 */

const CORRECT_PIN = '4829';
const WRONG_PIN = '0000';

let storedRow: PinRow;

beforeAll(async () => {
  const { pin_hash, pin_salt } = await hashPin(CORRECT_PIN);
  storedRow = {
    pin_hash,
    pin_salt,
    failed_attempt_count: 0,
    lockout_until: null,
  };
}, 10_000);

function rowWith(overrides: Partial<PinRow>): PinRow {
  return { ...storedRow, ...overrides };
}

describe('hashPin — BLOB-compatible output', () => {
  it('pin_hash is a Buffer (schema: BLOB NOT NULL)', () => {
    expect(Buffer.isBuffer(storedRow.pin_hash)).toBe(true);
  });

  it('pin_hash decodes to a PHC-formatted Argon2id string', () => {
    expect(storedRow.pin_hash.toString('utf8')).toMatch(/^\$argon2id\$/);
  });

  it('pin_salt is a Buffer (schema: BLOB NOT NULL)', () => {
    expect(Buffer.isBuffer(storedRow.pin_salt)).toBe(true);
  });

  it('pin_salt is exactly 16 bytes', () => {
    expect(storedRow.pin_salt.byteLength).toBe(16);
  });
});

describe('verifyPin — match', () => {
  it('correct PIN returns { kind: match }', async () => {
    const result = await verifyPin(CORRECT_PIN, storedRow);
    expect(result).toEqual({ kind: 'match' });
  });
});

describe('verifyPin — no_match', () => {
  it('wrong PIN returns { kind: no_match }', async () => {
    const result = await verifyPin(WRONG_PIN, storedRow);
    expect(result.kind).toBe('no_match');
  });

  it('increments failed_attempt_count from 0 to 1', async () => {
    const result = await verifyPin(WRONG_PIN, rowWith({ failed_attempt_count: 0 }));
    expect(result).toMatchObject({ kind: 'no_match', newFailedCount: 1, newLockoutUntil: null });
  });

  it('increments failed_attempt_count from 3 to 4 (no lockout yet)', async () => {
    const result = await verifyPin(WRONG_PIN, rowWith({ failed_attempt_count: 3 }));
    expect(result).toMatchObject({ kind: 'no_match', newFailedCount: 4, newLockoutUntil: null });
  });

  it('lockout triggers at failure 5 — newLockoutUntil is set ~5 min in the future', async () => {
    const before = Date.now();
    const result = await verifyPin(WRONG_PIN, rowWith({ failed_attempt_count: 4 }));
    const after = Date.now();

    expect(result.kind).toBe('no_match');
    if (result.kind !== 'no_match') return;

    expect(result.newFailedCount).toBe(5);

    const lockoutUntil = result.newLockoutUntil;
    expect(lockoutUntil).not.toBeNull();
    if (lockoutUntil === null) return;

    const lockoutTs = new Date(lockoutUntil).getTime();
    expect(lockoutTs).toBeGreaterThanOrEqual(before + 4 * 60 * 1000);
    expect(lockoutTs).toBeLessThanOrEqual(after + 6 * 60 * 1000);
  });
});

describe('verifyPin — lockout persistence (simulated restart)', () => {
  it('returns locked_out when lockout_until is in the future', async () => {
    const future = new Date(Date.now() + 4 * 60 * 1000).toISOString();
    const result = await verifyPin(CORRECT_PIN, rowWith({ lockout_until: future }));
    expect(result).toEqual({ kind: 'locked_out' });
  });

  it('correct PIN during active lockout is blocked (pre-verify lockout check)', async () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    const result = await verifyPin(CORRECT_PIN, rowWith({ lockout_until: future }));
    expect(result.kind).toBe('locked_out');
  });

  it('wrong PIN during active lockout is blocked', async () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    const result = await verifyPin(WRONG_PIN, rowWith({ lockout_until: future }));
    expect(result.kind).toBe('locked_out');
  });

  it('expired lockout allows verification to proceed', async () => {
    const past = new Date(Date.now() - 1000).toISOString();
    const result = await verifyPin(CORRECT_PIN, rowWith({ lockout_until: past }));
    expect(result).toEqual({ kind: 'match' });
  });
});

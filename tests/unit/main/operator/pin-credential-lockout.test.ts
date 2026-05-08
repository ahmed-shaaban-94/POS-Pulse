import { beforeAll, describe, expect, it } from 'vitest';

import { hashPin, type PinRow } from '../../../../src/main/operator/pin-credential.js';
import { unlockPinRow, verifyPinWithWindow } from '../../../../src/main/operator/pin-lockout.js';

/**
 * 004-operator-session T054 — PR-3 lockout policy tests.
 *
 * Verifies the schema-compatible threshold lockout in pin-lockout.ts:
 *
 *  - 5 cumulative failures triggers lockout (newLockoutUntil set).
 *  - Active lockout blocks all attempts, even with correct PIN (PR-3).
 *  - Expired lockout resets failed_attempt_count to 0 (post-lockout expiry
 *    reset); next failure starts counter at 1, not at pre-lockout value.
 *  - Expired lockout + correct PIN → match (lockout fully released).
 *  - Manager unlock (unlockPinRow) clears lockout_until and
 *    failed_attempt_count; subsequent verification succeeds (PR-3 release).
 *
 * Note: true "5 failures within 5 minutes" pre-lockout rolling window is not
 * implementable with the current schema (no failure-window timestamp column).
 * This tests the lockout foundation allowed by the existing schema.
 *
 * Performance: one Argon2id hash computed in beforeAll; shared across all
 * tests to keep the suite fast (see T052 note).
 */

const CORRECT_PIN = '7391';
const WRONG_PIN = '0000';

let baseRow: PinRow;

beforeAll(async () => {
  const { pin_hash, pin_salt } = await hashPin(CORRECT_PIN);
  baseRow = { pin_hash, pin_salt, failed_attempt_count: 0, lockout_until: null };
}, 10_000);

function rowWith(overrides: Partial<PinRow>): PinRow {
  return { ...baseRow, ...overrides };
}

function futureTs(offsetMs = 5 * 60 * 1000): string {
  return new Date(Date.now() + offsetMs).toISOString();
}

function pastTs(offsetMs = 1000): string {
  return new Date(Date.now() - offsetMs).toISOString();
}

// ---------------------------------------------------------------------------
// Active lockout — PR-3: attempts blocked even with correct PIN
// ---------------------------------------------------------------------------

describe('verifyPinWithWindow — active lockout', () => {
  it('correct PIN returns locked_out when lockout_until is in the future', async () => {
    const result = await verifyPinWithWindow(CORRECT_PIN, rowWith({ lockout_until: futureTs() }));
    expect(result.kind).toBe('locked_out');
  });

  it('wrong PIN returns locked_out when lockout_until is in the future', async () => {
    const result = await verifyPinWithWindow(WRONG_PIN, rowWith({ lockout_until: futureTs() }));
    expect(result.kind).toBe('locked_out');
  });

  it('5th consecutive failure sets newLockoutUntil ~5 min in the future', async () => {
    const before = Date.now();
    const result = await verifyPinWithWindow(WRONG_PIN, rowWith({ failed_attempt_count: 4 }));
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

// ---------------------------------------------------------------------------
// Post-lockout expiry reset — expired lockout resets the failure count
// ---------------------------------------------------------------------------

describe('verifyPinWithWindow — post-lockout expiry reset', () => {
  it('expired lockout + correct PIN returns match (lockout released, count reset to 0)', async () => {
    // Simulate a row that was locked out but the window has since passed.
    const result = await verifyPinWithWindow(
      CORRECT_PIN,
      rowWith({ failed_attempt_count: 5, lockout_until: pastTs() }),
    );
    expect(result).toEqual({ kind: 'match' });
  });

  it('expired lockout + wrong PIN resets counter to 1 (not 6)', async () => {
    // Expired lockout resets failed_attempt_count to 0; one wrong attempt → newFailedCount 1.
    const result = await verifyPinWithWindow(
      WRONG_PIN,
      rowWith({ failed_attempt_count: 5, lockout_until: pastTs() }),
    );
    expect(result.kind).toBe('no_match');
    if (result.kind !== 'no_match') return;
    // Counter must restart from 0, so one wrong attempt produces newFailedCount = 1.
    expect(result.newFailedCount).toBe(1);
    // One failure is below the lockout threshold — no new lockout.
    expect(result.newLockoutUntil).toBeNull();
  });

  it('expired lockout + 1 wrong PIN produces newFailedCount 1 (below lockout threshold)', async () => {
    // Expiry reset clears count to 0; one wrong attempt → count 1, below threshold (no new lockout).
    const result = await verifyPinWithWindow(
      WRONG_PIN,
      rowWith({ failed_attempt_count: 5, lockout_until: pastTs() }),
    );
    expect(result.kind).toBe('no_match');
    if (result.kind !== 'no_match') return;
    // count resets to 0 then increments to 1 — well below threshold.
    expect(result.newLockoutUntil).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Manager unlock — PR-3 release path via unlockPinRow
// ---------------------------------------------------------------------------

describe('unlockPinRow — manager unlock releases lockout', () => {
  it('unlockPinRow clears lockout_until and resets failed_attempt_count', () => {
    const locked = rowWith({ failed_attempt_count: 5, lockout_until: futureTs() });
    const unlocked = unlockPinRow(locked);
    expect(unlocked.lockout_until).toBeNull();
    expect(unlocked.failed_attempt_count).toBe(0);
  });

  it('unlockPinRow does not mutate the original row (immutable transform)', () => {
    const locked = rowWith({ failed_attempt_count: 5, lockout_until: futureTs() });
    unlockPinRow(locked);
    expect(locked.failed_attempt_count).toBe(5);
    expect(locked.lockout_until).not.toBeNull();
  });

  it('verifyPinWithWindow succeeds with correct PIN after manager unlock', async () => {
    const locked = rowWith({ failed_attempt_count: 5, lockout_until: futureTs() });
    const unlocked = unlockPinRow(locked);
    const result = await verifyPinWithWindow(CORRECT_PIN, unlocked);
    expect(result).toEqual({ kind: 'match' });
  });

  it('verifyPinWithWindow on a non-locked row returns match for correct PIN', async () => {
    const result = await verifyPinWithWindow(CORRECT_PIN, rowWith({ lockout_until: null }));
    expect(result).toEqual({ kind: 'match' });
  });
});

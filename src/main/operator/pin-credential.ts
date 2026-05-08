/**
 * 004-operator-session T066 — Argon2id PIN verifier.
 *
 * AD-2: PIN never leaves the local process. No logger injected — structural
 * guarantee that the PIN value cannot reach pino or any other log surface
 * from this module (PR-1 / FR-030).
 *
 * Parameters from research.md §1:
 *   m_cost=64 MiB, t_cost=3, p_cost=1, salt=16 random bytes, output=32 bytes.
 *
 * Caller contract: the verifier is a pure compute function. It does NOT write
 * back to the DB. The caller must persist `newFailedCount` and `newLockoutUntil`
 * from a `no_match` result to maintain the PR-3 lockout state.
 */

import argon2 from 'argon2';
import { randomBytes } from 'node:crypto';

export interface PinRow {
  /** PHC-formatted Argon2id string. Salt is embedded; no separate salt needed for verify. */
  pin_hash: string;
  /** Hex of the 16-byte salt — stored for audit per data-model §Entity 6; unused by verify. */
  pin_salt: string;
  failed_attempt_count: number;
  /** ISO-8601 timestamp or null. Non-null and in the future → locked. */
  lockout_until: string | null;
}

export type PinVerifyResult =
  | { kind: 'match' }
  | { kind: 'no_match'; newFailedCount: number; newLockoutUntil: string | null }
  | { kind: 'locked_out' };

const ARGON2_OPTS = {
  type: argon2.argon2id,
  memoryCost: 64 * 1024,
  timeCost: 3,
  parallelism: 1,
  hashLength: 32,
} as const;

const MAX_FAILURES = 5;
const LOCKOUT_MS = 5 * 60 * 1000;

export async function hashPin(pin: string): Promise<{ pin_hash: string; pin_salt: string }> {
  const salt = randomBytes(16);
  const pin_hash = await argon2.hash(pin, { ...ARGON2_OPTS, salt });
  return { pin_hash, pin_salt: salt.toString('hex') };
}

export async function verifyPin(pin: string, row: PinRow): Promise<PinVerifyResult> {
  if (row.lockout_until !== null && new Date(row.lockout_until) > new Date()) {
    return { kind: 'locked_out' };
  }

  const match = await argon2.verify(row.pin_hash, pin);

  if (match) return { kind: 'match' };

  const newFailedCount = row.failed_attempt_count + 1;
  const newLockoutUntil =
    newFailedCount >= MAX_FAILURES ? new Date(Date.now() + LOCKOUT_MS).toISOString() : null;

  return { kind: 'no_match', newFailedCount, newLockoutUntil };
}

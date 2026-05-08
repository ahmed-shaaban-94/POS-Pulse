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
 * BLOB representation:
 *   Both `pin_hash` and `pin_salt` are stored as BLOB in
 *   migrations/0006_cashier_pin_records.sql — never TEXT.
 *   `pin_hash` holds the UTF-8 bytes of the Argon2id PHC string
 *   (e.g. `$argon2id$v=19$m=65536,t=3,p=1$<salt_b64>$<hash_b64>`).
 *   argon2.verify() requires a PHC string; call `row.pin_hash.toString('utf8')`
 *   inside this module to recover it. This conversion is the only place it
 *   happens — callers always pass the raw Buffer read from SQLite.
 *
 * Caller contract: the verifier is a pure compute function. It does NOT write
 * back to the DB. The caller must persist `newFailedCount` and `newLockoutUntil`
 * from a `no_match` result to maintain the PR-3 lockout state.
 */

import argon2 from 'argon2';
import { randomBytes } from 'node:crypto';

export interface PinRow {
  /**
   * UTF-8 bytes of the Argon2id PHC string, stored as BLOB per schema.
   * The PHC format embeds the salt in Base64 — argon2.verify() recovers it
   * from this string internally. Do not pass `pin_salt` to argon2.verify().
   */
  pin_hash: Buffer;
  /**
   * 16 raw bytes of the per-record salt, stored as BLOB per schema.
   * Retained for audit per data-model §Entity 6. argon2.verify() reads the
   * salt from the PHC string embedded in `pin_hash`; this field is not
   * consumed during verification.
   */
  pin_salt: Buffer;
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

export async function hashPin(pin: string): Promise<{ pin_hash: Buffer; pin_salt: Buffer }> {
  const pin_salt = randomBytes(16);
  const phcString = await argon2.hash(pin, { ...ARGON2_OPTS, salt: pin_salt });
  // Store PHC string as UTF-8 bytes so the BLOB column carries exact bytes
  // needed by argon2.verify() without any re-encoding loss.
  return { pin_hash: Buffer.from(phcString, 'utf8'), pin_salt };
}

export async function verifyPin(pin: string, row: PinRow): Promise<PinVerifyResult> {
  if (row.lockout_until !== null && new Date(row.lockout_until) > new Date()) {
    return { kind: 'locked_out' };
  }

  // Recover the PHC string from the BLOB column bytes (BLOB → UTF-8 → PHC).
  const phcString = row.pin_hash.toString('utf8');
  const match = await argon2.verify(phcString, pin);

  if (match) return { kind: 'match' };

  const newFailedCount = row.failed_attempt_count + 1;
  const newLockoutUntil =
    newFailedCount >= MAX_FAILURES ? new Date(Date.now() + LOCKOUT_MS).toISOString() : null;

  return { kind: 'no_match', newFailedCount, newLockoutUntil };
}

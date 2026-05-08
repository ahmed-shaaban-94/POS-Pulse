/**
 * 004-operator-session T067 — PR-3 lockout state machine + PR-4 scope guard.
 *
 * AD-2: PIN never leaves the local process. No logger injected — structural
 * guarantee that the PIN value cannot reach pino or any other log surface
 * from this module (PR-1 / FR-030).
 *
 * Schema-compatible lockout design (existing schema: failed_attempt_count +
 * lockout_until only — no first_failed_at / failed_window_started_at):
 *   5 cumulative failures → lockout_until set to now + 5 min.
 *   Active lockout blocks all attempts. Expired lockout resets
 *   failed_attempt_count to 0 before verification (post-lockout expiry reset).
 *   True "5 failures within 5 minutes" pre-lockout rolling window would
 *   require a failure-window timestamp column (not in current schema).
 *
 * Caller contract (same as pin-credential.ts):
 *   Pure compute — does NOT write to DB.
 *   Caller must persist newFailedCount / newLockoutUntil from no_match results.
 *   Manager unlock: call unlockPinRow() and persist the returned row to DB,
 *   then emit the cashier.pin.unlock audit event (T073 bridge handler).
 */

import { verifyPin, type PinRow, type PinVerifyResult } from './pin-credential.js';

export type { PinRow, PinVerifyResult };

/** Composite key that uniquely identifies a cashier_pin_records row. */
export interface PinScope {
  tenant_id: string;
  branch_id: string;
  terminal_id: string;
  cashier_clerk_user_id: string;
}

/** A PinRow enriched with its composite scope key fields. */
export type ScopedPinRow = PinRow & PinScope;

/**
 * PR-4 scope guard — returns true only when all four composite key fields
 * match. Prevents a row fetched for one terminal from being used on another.
 * Callers MUST check this before calling verifyPinWithWindow.
 */
export function rowMatchesScope(row: ScopedPinRow, scope: PinScope): boolean {
  return (
    row.tenant_id === scope.tenant_id &&
    row.branch_id === scope.branch_id &&
    row.terminal_id === scope.terminal_id &&
    row.cashier_clerk_user_id === scope.cashier_clerk_user_id
  );
}

/**
 * PR-3 threshold lockout verifier (schema-compatible).
 *
 * Post-lockout expiry reset: if lockout_until is in the past, resets
 * failed_attempt_count to 0 before delegating to verifyPin. This clears
 * the failure count once the lockout window elapses — not a pre-lockout
 * rolling-window guard (current schema has no failure-window timestamp).
 *
 * Active lockouts (lockout_until in the future) are passed through unchanged;
 * verifyPin returns { kind: 'locked_out' } directly.
 */
export async function verifyPinWithWindow(pin: string, row: PinRow): Promise<PinVerifyResult> {
  const lockoutExpired = row.lockout_until !== null && new Date(row.lockout_until) <= new Date();

  const effectiveRow = lockoutExpired
    ? { ...row, failed_attempt_count: 0, lockout_until: null }
    : row;

  return verifyPin(pin, effectiveRow);
}

/**
 * Manager unlock (PR-3 release path).
 *
 * Returns a new PinRow with lockout_until cleared to null and
 * failed_attempt_count reset to 0. Immutable — the original row is not
 * mutated. Caller persists the result to DB and emits cashier.pin.unlock
 * audit event via the T073 bridge handler.
 */
export function unlockPinRow(row: PinRow): PinRow {
  return { ...row, failed_attempt_count: 0, lockout_until: null };
}

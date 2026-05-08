import { beforeAll, describe, expect, it } from 'vitest';

import { hashPin, type PinRow } from '../../../../src/main/operator/pin-credential.js';
import {
  rowMatchesScope,
  verifyPinWithWindow,
  type PinScope,
  type ScopedPinRow,
} from '../../../../src/main/operator/pin-lockout.js';

/**
 * 004-operator-session T055 — PR-4 per-terminal scope tests.
 *
 * Verifies that cashier_pin_records rows are scoped to the composite key
 * (tenant_id, branch_id, terminal_id, cashier_clerk_user_id) per the
 * schema PRIMARY KEY in migrations/0006_cashier_pin_records.sql.
 *
 *  - rowMatchesScope returns true only when all four fields match.
 *  - Changing any single field produces a non-matching scope (different
 *    DB row — "unreadable" from the mismatched terminal/tenant/branch).
 *  - Two rows with different terminal_ids carry independent lockout state:
 *    a lockout on terminal A does not affect terminal B's row.
 *  - A row looked up for terminal T1 cannot be used to verify a cashier on
 *    terminal T2 (scope guard enforces lookup is always key-exact).
 *
 * Performance: one Argon2id hash computed in beforeAll; shared across tests.
 */

const PIN = '5520';

let pinRow: PinRow;

beforeAll(async () => {
  const { pin_hash, pin_salt } = await hashPin(PIN);
  pinRow = { pin_hash, pin_salt, failed_attempt_count: 0, lockout_until: null };
}, 10_000);

const BASE_SCOPE: PinScope = {
  tenant_id: 'tenant-alpha',
  branch_id: 'branch-01',
  terminal_id: 'terminal-A',
  cashier_clerk_user_id: 'user_clerk_001',
};

function scopedRow(overrides: Partial<PinScope> = {}): ScopedPinRow {
  return { ...pinRow, ...BASE_SCOPE, ...overrides };
}

// ---------------------------------------------------------------------------
// rowMatchesScope — exact match and field-level mismatches
// ---------------------------------------------------------------------------

describe('rowMatchesScope — composite key enforcement', () => {
  it('returns true when all four scope fields match', () => {
    expect(rowMatchesScope(scopedRow(), BASE_SCOPE)).toBe(true);
  });

  it('returns false when terminal_id differs (different terminal)', () => {
    expect(rowMatchesScope(scopedRow({ terminal_id: 'terminal-B' }), BASE_SCOPE)).toBe(false);
  });

  it('returns false when tenant_id differs (cross-tenant isolation)', () => {
    expect(rowMatchesScope(scopedRow({ tenant_id: 'tenant-beta' }), BASE_SCOPE)).toBe(false);
  });

  it('returns false when branch_id differs (cross-branch isolation)', () => {
    expect(rowMatchesScope(scopedRow({ branch_id: 'branch-02' }), BASE_SCOPE)).toBe(false);
  });

  it('returns false when cashier_clerk_user_id differs (different cashier)', () => {
    expect(
      rowMatchesScope(scopedRow({ cashier_clerk_user_id: 'user_clerk_002' }), BASE_SCOPE),
    ).toBe(false);
  });

  it('a row for terminal-B does not match the terminal-A scope', () => {
    const terminalBRow = scopedRow({ terminal_id: 'terminal-B' });
    expect(rowMatchesScope(terminalBRow, BASE_SCOPE)).toBe(false);
  });

  it('a row for terminal-A does not match the terminal-B scope', () => {
    const terminalARow = scopedRow();
    const terminalBScope: PinScope = { ...BASE_SCOPE, terminal_id: 'terminal-B' };
    expect(rowMatchesScope(terminalARow, terminalBScope)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Independent lockout state per terminal
// ---------------------------------------------------------------------------

describe('per-terminal lockout independence', () => {
  it('lockout on terminal-A row does not affect terminal-B row', async () => {
    // Terminal A is locked out.
    const terminalARow = scopedRow({
      terminal_id: 'terminal-A',
      failed_attempt_count: 5,
      lockout_until: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    });
    // Terminal B has a fresh row — same cashier, different terminal.
    const terminalBRow = scopedRow({
      terminal_id: 'terminal-B',
      failed_attempt_count: 0,
      lockout_until: null,
    });

    const resultA = await verifyPinWithWindow(PIN, terminalARow);
    const resultB = await verifyPinWithWindow(PIN, terminalBRow);

    expect(resultA.kind).toBe('locked_out');
    expect(resultB.kind).toBe('match');
  });

  it('wrong-PIN failure on terminal-A does not increment terminal-B failure count', async () => {
    const terminalARow = scopedRow({ terminal_id: 'terminal-A', failed_attempt_count: 3 });
    const terminalBRow = scopedRow({ terminal_id: 'terminal-B', failed_attempt_count: 0 });

    const resultA = await verifyPinWithWindow('9999', terminalARow);
    // Terminal B is a separate object — its count is unaffected.
    const resultB = await verifyPinWithWindow('9999', terminalBRow);

    expect(resultA.kind).toBe('no_match');
    if (resultA.kind === 'no_match') expect(resultA.newFailedCount).toBe(4);

    expect(resultB.kind).toBe('no_match');
    if (resultB.kind === 'no_match') expect(resultB.newFailedCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Cross-terminal non-reuse: using the wrong row produces an incorrect result
// ---------------------------------------------------------------------------

describe('cross-terminal PIN non-reuse', () => {
  it('a scope mismatch is detectable before verification', () => {
    // If the caller accidentally fetches terminal-B row for a terminal-A request,
    // rowMatchesScope catches it before the pin is ever checked.
    const terminalBRow = scopedRow({ terminal_id: 'terminal-B' });
    const terminalAScope: PinScope = { ...BASE_SCOPE, terminal_id: 'terminal-A' };

    // The scope guard returns false — caller must not proceed to verifyPinWithWindow.
    expect(rowMatchesScope(terminalBRow, terminalAScope)).toBe(false);
  });
});

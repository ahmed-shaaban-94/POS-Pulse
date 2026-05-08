import { describe, expect, it, vi } from 'vitest';

import { RosterHandler } from '../../../../src/main/operator/roster-handler.js';
import type {
  BackendClient,
  BackendRosterResponse,
} from '../../../../src/main/operator/backend-client.js';

/**
 * 004-operator-session T070a — operator.listBranchRoster main-side handler.
 *
 * Verifies:
 *  - Allowlist redaction: only {id, display_name, role} cross the bridge
 *    per FR-006 / FR-031 (no email, phone, PIN material, audit history).
 *  - Branch scoping: the correct branchId is forwarded to the backend.
 *  - Failure-mode collapse: no_connection → refused/no_connection;
 *    refused → refused/invalid_input (PR-2 / NFR-003).
 *  - Empty roster is valid.
 *  - FR-032 redaction: cashier display names NEVER appear in any pino
 *    log call.
 */

function fakeBackend(
  result: BackendRosterResponse,
  calls: { branchId?: string }[] = [],
): BackendClient {
  return {
    signIn: vi.fn(() => Promise.resolve({ kind: 'refused' as const })),
    signOut: vi.fn(() => Promise.resolve({ kind: 'refused' as const })),
    listRoster: vi.fn((branchId: string) => {
      calls.push({ branchId });
      return Promise.resolve(result);
    }),
    confirmTakeover: vi.fn(() => Promise.resolve({ kind: 'refused' as const })),
    getActiveSession: vi.fn(() => Promise.resolve({ kind: 'refused' as const })),
  };
}

const HAPPY_BACKEND_ROSTER: BackendRosterResponse = {
  kind: 'roster',
  cashiers: [
    { id: 'c-1', display_name: 'Ali Hassan', role: 'cashier' },
    { id: 'c-2', display_name: 'Sara Nabil', role: 'cashier' },
  ],
};

describe('RosterHandler', () => {
  it('happy path: returns roster cashiers with only {id, display_name, role}', async () => {
    const handler = new RosterHandler({ backend: fakeBackend(HAPPY_BACKEND_ROSTER) });
    const res = await handler.listRoster('branch-42');
    expect(res).toEqual({
      kind: 'roster',
      cashiers: [
        { id: 'c-1', display_name: 'Ali Hassan', role: 'cashier' },
        { id: 'c-2', display_name: 'Sara Nabil', role: 'cashier' },
      ],
    });
  });

  it('forwards the branchId to the backend (branch scoping)', async () => {
    const calls: { branchId?: string }[] = [];
    const handler = new RosterHandler({ backend: fakeBackend(HAPPY_BACKEND_ROSTER, calls) });
    await handler.listRoster('branch-99');
    expect(calls).toHaveLength(1);
    expect(calls[0]?.branchId).toBe('branch-99');
  });

  it('strips extra backend fields — allowlist defence in depth (FR-006, FR-031)', async () => {
    // Simulate a backend that leaks extra fields beyond the contract.
    // Cast via unknown to bypass the type-level restriction and test the
    // runtime allowlist filter.
    const leakyRoster = {
      kind: 'roster' as const,
      cashiers: [
        {
          id: 'c-1',
          display_name: 'Test Cashier',
          role: 'cashier' as const,
          email: 'test@pharmacy.test',
          phone: '+966-555-0001',
          pin_hash: 'hash123',
        },
      ],
    } as unknown as BackendRosterResponse;
    const handler = new RosterHandler({ backend: fakeBackend(leakyRoster) });
    const res = await handler.listRoster('b1');
    expect(res.kind).toBe('roster');
    if (res.kind === 'roster') {
      const cashier = res.cashiers[0];
      expect(cashier).toEqual({ id: 'c-1', display_name: 'Test Cashier', role: 'cashier' });
      expect(cashier).not.toHaveProperty('email');
      expect(cashier).not.toHaveProperty('phone');
      expect(cashier).not.toHaveProperty('pin_hash');
    }
  });

  it('accepts an empty cashiers array', async () => {
    const handler = new RosterHandler({
      backend: fakeBackend({ kind: 'roster', cashiers: [] }),
    });
    const res = await handler.listRoster('b1');
    expect(res).toEqual({ kind: 'roster', cashiers: [] });
  });

  it('maps no_connection to refused/no_connection', async () => {
    const handler = new RosterHandler({
      backend: fakeBackend({ kind: 'no_connection' }),
    });
    const res = await handler.listRoster('b1');
    expect(res).toEqual({ kind: 'refused', category: 'no_connection' });
  });

  it('maps refused to refused/invalid_input', async () => {
    const handler = new RosterHandler({
      backend: fakeBackend({ kind: 'refused' }),
    });
    const res = await handler.listRoster('b1');
    expect(res).toEqual({ kind: 'refused', category: 'invalid_input' });
  });

  it('FR-032 redaction: logger never receives cashier display names', async () => {
    const logCalls: unknown[] = [];
    const logger = {
      info: (...args: unknown[]) => logCalls.push(...args),
      warn: (...args: unknown[]) => logCalls.push(...args),
      error: (...args: unknown[]) => logCalls.push(...args),
      debug: (...args: unknown[]) => logCalls.push(...args),
      trace: (...args: unknown[]) => logCalls.push(...args),
      fatal: (...args: unknown[]) => logCalls.push(...args),
      child: () => ({ info: () => undefined, warn: () => undefined }) as unknown,
    } as unknown as NonNullable<ConstructorParameters<typeof RosterHandler>[0]['logger']>;

    const rosterWithNames: BackendRosterResponse = {
      kind: 'roster',
      cashiers: [
        { id: 'c-1', display_name: 'Sensitive Name One', role: 'cashier' },
        { id: 'c-2', display_name: 'Sensitive Name Two', role: 'cashier' },
      ],
    };
    const handler = new RosterHandler({ backend: fakeBackend(rosterWithNames), logger });
    await handler.listRoster('b1');

    const serialized = JSON.stringify(logCalls);
    expect(serialized).not.toContain('Sensitive Name One');
    expect(serialized).not.toContain('Sensitive Name Two');
  });
});

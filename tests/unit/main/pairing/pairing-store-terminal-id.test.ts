import { describe, expect, it, vi } from 'vitest';
import {
  createPairingStore,
  type PairingStoreDb,
  type TerminalAssignmentRow,
} from '../../../../src/main/pairing/store.js';
import { makeSecretKey, type SecretStore } from '../../../../src/shared/secret-store.js';

/**
 * #380 (F-007) — `getCurrentTerminalId()` is the SYNC accessor the payment /
 * sales / cart session adapters use to stamp the REAL terminal_id instead of
 * the branch_id shortcut.
 *
 * It must be synchronous (the adapters are sync closures called per-operation;
 * making them async would ripple through the whole payment handler chain). It
 * reads the plaintext `terminal_id` column via the store's sync
 * `db.readAssignment()` — NOT the async token/safeStorage path that
 * `getStatus()` awaits (that await is load-bearing only for the device-token
 * decrypt, not for the scope identity).
 */

const TENANT = 'tenant-1';
const BRANCH = 'branch-637af303';
const TERMINAL = 'terminal-0556bfa4';

function row(overrides: Partial<TerminalAssignmentRow> = {}): TerminalAssignmentRow {
  return {
    tenant_id: TENANT,
    branch_id: BRANCH,
    terminal_id: TERMINAL,
    terminal_label: 'Pilot Counter 1',
    paired_at: 0,
    branch_name: null,
    branch_address: null,
    tenant_tax_registration_id: null,
    printer_vendor_id: null,
    printer_product_id: null,
    printer_com_port: null,
    ...overrides,
  };
}

function makeDb(assignment: TerminalAssignmentRow | null): PairingStoreDb {
  return {
    readAssignment: vi.fn(() => assignment),
    writeAssignment: vi.fn(),
    deleteAssignment: vi.fn(),
    transaction: vi.fn((fn) => fn()),
  };
}

function makeSecretStore(): SecretStore {
  // Never touched by getCurrentTerminalId — its presence proves the accessor
  // does NOT go through the token path.
  return {
    get: vi.fn(() => Promise.reject(new Error('secret store must not be read'))),
    set: vi.fn(),
    delete: vi.fn(),
  } as unknown as SecretStore;
}

function makeStore(assignment: TerminalAssignmentRow | null) {
  const db = makeDb(assignment);
  const secretStore = makeSecretStore();
  const store = createPairingStore({
    secretStore,
    db,
    deviceTokenKey: makeSecretKey('device-token'),
  });
  return { store, db, secretStore };
}

describe('#380 getCurrentTerminalId — sync real-terminal-id accessor', () => {
  it('returns the assignment row terminal_id (the REAL terminal, not branch_id)', () => {
    const { store } = makeStore(row());
    const result = store.getCurrentTerminalId();
    expect(result).toBe(TERMINAL);
    expect(result).not.toBe(BRANCH); // the F-007 bug stamped branch_id here
  });

  it('returns null when no assignment row exists (unpaired)', () => {
    const { store } = makeStore(null);
    expect(store.getCurrentTerminalId()).toBeNull();
  });

  it('is synchronous (returns a string|null, not a Promise) and never reads the SecretStore', () => {
    const { store, secretStore } = makeStore(row());
    const result = store.getCurrentTerminalId();
    expect(result).not.toBeInstanceOf(Promise);
    expect(secretStore.get).not.toHaveBeenCalled();
  });
});

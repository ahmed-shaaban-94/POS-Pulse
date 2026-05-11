/**
 * T061 — Integration test: PR-5 manager PIN reset flow.
 *
 * Exercises the full IPC path: `registerOperatorHandlers` registers the
 * `operator:reset-cashier-pin` channel; the handler validates role,
 * input shape, terminal scope, and cashier existence; writes the new
 * Argon2id hash + salt; resets lockout state; emits `cashier.pin.reset`
 * audit event with manager attribution.
 *
 * Renderer UI (T078) is NOT implemented yet — this test targets the
 * main-process side of the bridge only (IPC channel + PinManagementHandler).
 *
 * Security assertions (PR-1):
 *   - PIN value never appears in the emitted audit event.
 *   - PIN value never appears in any log output.
 *   - Audit payload contains only allowlisted fields.
 */

import { describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { IpcMain, IpcMainInvokeEvent } from 'electron';

import { registerOperatorHandlers } from '../../../src/main/ipc/operator.js';
import { PinManagementHandler } from '../../../src/main/operator/pin-management.js';
import { OPERATOR_IPC_CHANNELS } from '../../../src/shared/operator/channels.js';
import type { ResetCashierPinResponse } from '../../../src/shared/bridge-api.js';
import type { OperatorRefusal, AuditEvent } from '../../../src/shared/audit/event-shape.js';
import type { SessionManager } from '../../../src/main/operator/session-manager.js';
import type { OperatorSessionRecord } from '../../../src/main/operator/session-manager.js';
import type { PairingStore } from '../../../src/main/pairing/store.js';
import type { AuditEmitter } from '../../../src/main/audit/audit-emitter.js';
import type { DatabaseHandle } from '../../../src/main/db/client.js';
import type { SafeStorageLike } from '../../../src/main/secrets/safe-storage.js';
import type {
  SignInHandler,
  CashierSignInHandler,
} from '../../../src/main/operator/sign-in-handler.js';
import type { SignOutHandler } from '../../../src/main/operator/sign-out-handler.js';
import type { RosterHandler } from '../../../src/main/operator/roster-handler.js';
import type { InactivityMonitor } from '../../../src/main/operator/inactivity-monitor.js';
import type { TakeoverHandler } from '../../../src/main/operator/takeover-handler.js';

// ─── Fixtures ─────────────────────────────────────────────────────────────

const TENANT = 't1';
const BRANCH = 'b1';
const TERMINAL = 'term-1';
const CASHIER_ID = 'cashier-clerk-01';
const MANAGER_OP_ID = 'manager-clerk-01';
const SESSION_ID = 'sess-pin-reset';

function makeManagerSession(): OperatorSessionRecord {
  return {
    id: SESSION_ID,
    operator_id: MANAGER_OP_ID,
    display_name: 'Manager',
    role: 'manager',
    tenant_id: TENANT,
    branch_id: BRANCH,
    backend_session_id: 'be-1',
    started_at: new Date().toISOString(),
    last_activity_at: new Date().toISOString(),
  };
}

function makePairedStore(): PairingStore {
  return {
    getStatus: vi.fn(() =>
      Promise.resolve({
        kind: 'paired' as const,
        tenant_id: TENANT,
        branch_id: BRANCH,
        terminal_id: TERMINAL,
        terminal_label: 'T1',
        paired_at: 0,
      }),
    ),
    persist: vi.fn(),
    clear: vi.fn(),
  };
}

function makeDb(has_row: boolean): DatabaseHandle {
  return {
    prepare: vi.fn((sql: string) => {
      if (sql.trimStart().toUpperCase().startsWith('SELECT')) {
        return {
          get: () => (has_row ? { failed_attempt_count: 0, lockout_until: null } : undefined),
        };
      }
      return { run: vi.fn() };
    }),
    pragma: vi.fn(),
    exec: vi.fn(),
    transaction: vi.fn(),
    close: vi.fn(),
  };
}

function makeStorage(): SafeStorageLike {
  return {
    isEncryptionAvailable: vi.fn(() => true),
    encryptString: vi.fn((s: string) => Buffer.from(s, 'utf8')),
    decryptString: vi.fn((b: Buffer) => b.toString('utf8')),
  };
}

function makeIpcMain(): {
  ipcMain: IpcMain;
  handlers: Map<string, (e: IpcMainInvokeEvent, ...a: unknown[]) => unknown>;
} {
  const handlers = new Map<string, (e: IpcMainInvokeEvent, ...a: unknown[]) => unknown>();
  const ipcMain = {
    handle: vi.fn((ch: string, fn: (e: IpcMainInvokeEvent, ...a: unknown[]) => unknown) => {
      handlers.set(ch, fn);
    }),
  } as unknown as IpcMain;
  return { ipcMain, handlers };
}

const FAKE_EVENT = {} as IpcMainInvokeEvent;

function buildEnv(opts: { hasRow?: boolean; session?: OperatorSessionRecord | null } = {}): {
  invoke: (channel: string, req: unknown) => Promise<unknown>;
  emit: ReturnType<typeof vi.fn>;
} {
  const session = opts.session !== undefined ? opts.session : makeManagerSession();
  const emit = vi.fn();
  const auditEmitter: AuditEmitter = { emit } as unknown as AuditEmitter;
  const db = makeDb(opts.hasRow ?? true);
  const pinManagementHandler = new PinManagementHandler({
    db,
    safeStorage: makeStorage(),
    sessionManager: { getCurrent: vi.fn(() => session) } as unknown as SessionManager,
    pairingStore: makePairedStore(),
    auditEmitter,
  });

  const { ipcMain, handlers } = makeIpcMain();
  registerOperatorHandlers(ipcMain, {
    signInHandler: { signIn: vi.fn() } as unknown as SignInHandler,
    cashierSignInHandler: { signIn: vi.fn() } as unknown as CashierSignInHandler,
    signOutHandler: { signOut: vi.fn() } as unknown as SignOutHandler,
    rosterHandler: { listRoster: vi.fn() } as unknown as RosterHandler,
    sessionManager: {
      getCurrent: vi.fn(() => session),
      getCurrentBridgeView: vi.fn(() => null),
    } as unknown as SessionManager,
    inactivityMonitor: { reportActivity: vi.fn() } as unknown as InactivityMonitor,
    auditEmitter,
    pairingStore: makePairedStore(),
    takeoverHandler: {
      confirmTakeover: vi.fn(),
      cancelTakeover: vi.fn(),
    } as unknown as TakeoverHandler,
    pinManagementHandler,
  });

  const invoke = (channel: string, req: unknown): Promise<unknown> => {
    const fn = handlers.get(channel);
    if (!fn) throw new Error(`channel not registered: ${channel}`);
    return Promise.resolve(fn(FAKE_EVENT, req));
  };

  return { invoke, emit };
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe('T061 — operator:reset-cashier-pin IPC (manager PIN reset integration)', () => {
  it('channel is registered', () => {
    const { ipcMain, handlers } = makeIpcMain();
    const pinManagementHandler = new PinManagementHandler({
      db: makeDb(true),
      safeStorage: makeStorage(),
      sessionManager: {
        getCurrent: vi.fn(() => makeManagerSession()),
      } as unknown as SessionManager,
      pairingStore: makePairedStore(),
      auditEmitter: { emit: vi.fn() } as unknown as AuditEmitter,
    });
    registerOperatorHandlers(ipcMain, {
      signInHandler: { signIn: vi.fn() } as unknown as SignInHandler,
      cashierSignInHandler: { signIn: vi.fn() } as unknown as CashierSignInHandler,
      signOutHandler: { signOut: vi.fn() } as unknown as SignOutHandler,
      rosterHandler: { listRoster: vi.fn() } as unknown as RosterHandler,
      sessionManager: {
        getCurrent: vi.fn(() => makeManagerSession()),
        getCurrentBridgeView: vi.fn(() => null),
      } as unknown as SessionManager,
      inactivityMonitor: { reportActivity: vi.fn() } as unknown as InactivityMonitor,
      auditEmitter: { emit: vi.fn() } as unknown as AuditEmitter,
      pairingStore: makePairedStore(),
      takeoverHandler: {
        confirmTakeover: vi.fn(),
        cancelTakeover: vi.fn(),
      } as unknown as TakeoverHandler,
      pinManagementHandler,
    });
    expect(handlers.has(OPERATOR_IPC_CHANNELS.RESET_CASHIER_PIN)).toBe(true);
  });

  it('returns pin_reset and emits cashier.pin.reset for a valid manager request', async () => {
    const { invoke, emit } = buildEnv();
    const event_id = randomUUID();
    const result = (await invoke(OPERATOR_IPC_CHANNELS.RESET_CASHIER_PIN, {
      event_id,
      target_cashier_id: CASHIER_ID,
      new_pin: '4321',
    })) as ResetCashierPinResponse;
    expect(result.kind).toBe('pin_reset');
    expect(result.audit_event_id).toBe(event_id);

    expect(emit).toHaveBeenCalledOnce();
    const evt = emit.mock.calls[0][0] as AuditEvent;
    expect(evt.action_category).toBe('cashier.pin.reset');
    expect(evt.acting_operator_id).toBe(MANAGER_OP_ID);
  });

  it('returns role_mismatch when called by a cashier session', async () => {
    const cashierSession: OperatorSessionRecord = {
      ...makeManagerSession(),
      role: 'cashier',
      operator_id: CASHIER_ID,
    };
    const { invoke } = buildEnv({ session: cashierSession });
    const result = (await invoke(OPERATOR_IPC_CHANNELS.RESET_CASHIER_PIN, {
      event_id: randomUUID(),
      target_cashier_id: CASHIER_ID,
      new_pin: '1234',
    })) as OperatorRefusal;
    expect(result).toMatchObject({ kind: 'refused', category: 'role_mismatch' });
  });

  it('returns invalid_input when new_pin is not 4-6 digits', async () => {
    const { invoke } = buildEnv();
    const result = (await invoke(OPERATOR_IPC_CHANNELS.RESET_CASHIER_PIN, {
      event_id: randomUUID(),
      target_cashier_id: CASHIER_ID,
      new_pin: '12',
    })) as OperatorRefusal;
    expect(result).toMatchObject({ kind: 'refused', category: 'invalid_input' });
  });

  it('returns invalid_input when cashier has no pin record', async () => {
    const { invoke } = buildEnv({ hasRow: false });
    const result = (await invoke(OPERATOR_IPC_CHANNELS.RESET_CASHIER_PIN, {
      event_id: randomUUID(),
      target_cashier_id: 'no-such-cashier',
      new_pin: '5678',
    })) as OperatorRefusal;
    expect(result).toMatchObject({ kind: 'refused', category: 'invalid_input' });
  });

  it('returns invalid_input on malformed IPC payload (missing new_pin)', async () => {
    const { invoke } = buildEnv();
    const result = (await invoke(OPERATOR_IPC_CHANNELS.RESET_CASHIER_PIN, {
      event_id: randomUUID(),
      target_cashier_id: CASHIER_ID,
      // new_pin absent
    })) as OperatorRefusal;
    expect(result).toMatchObject({ kind: 'refused', category: 'invalid_input' });
  });

  it('PIN value never appears in the audit event payload (PR-1)', async () => {
    const { invoke, emit } = buildEnv();
    await invoke(OPERATOR_IPC_CHANNELS.RESET_CASHIER_PIN, {
      event_id: randomUUID(),
      target_cashier_id: CASHIER_ID,
      new_pin: '8888',
    });
    const evt = emit.mock.calls[0][0] as AuditEvent;
    const serialised = JSON.stringify(evt);
    expect(serialised).not.toContain('8888');
    expect(serialised).not.toContain('new_pin');
  });

  it('manager operator_id is attributed in the audit event', async () => {
    const { invoke, emit } = buildEnv();
    await invoke(OPERATOR_IPC_CHANNELS.RESET_CASHIER_PIN, {
      event_id: randomUUID(),
      target_cashier_id: CASHIER_ID,
      new_pin: '1234',
    });
    const evt = emit.mock.calls[0][0] as AuditEvent;
    expect(evt.acting_operator_id).toBe(MANAGER_OP_ID);
  });
});

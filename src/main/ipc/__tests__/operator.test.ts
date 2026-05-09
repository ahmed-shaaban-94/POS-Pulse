import { describe, expect, it, vi } from 'vitest';
import type { IpcMain, IpcMainInvokeEvent } from 'electron';

import { registerOperatorHandlers } from '../operator.js';
import { OPERATOR_IPC_CHANNELS } from '../../../shared/operator/channels.js';
import type {
  BranchRosterCashier,
  ListBranchRosterResponse,
  OperatorSessionBridgeView,
  SignInResponse,
  SignOutResponse,
} from '../../../shared/bridge-api.js';
import { OperatorRefusalError } from '../../../shared/audit/event-shape.js';
import type { CashierSignInHandler, SignInHandler } from '../../operator/sign-in-handler.js';
import type { SignOutHandler } from '../../operator/sign-out-handler.js';
import type { RosterHandler } from '../../operator/roster-handler.js';
import type { SessionManager } from '../../operator/session-manager.js';
import type { InactivityMonitor } from '../../operator/inactivity-monitor.js';
import type { AuditEmitter } from '../../audit/audit-emitter.js';
import type { PairingStore } from '../../pairing/store.js';
import type { TakeoverHandler } from '../../operator/takeover-handler.js';

/**
 * 004-operator-session — IPC `operator:*` handler tests.
 *
 * Mirrors the 002 `pairing:*` IPC test pattern: handlers + state are
 * INJECTED, the channel names come from the canonical
 * OPERATOR_IPC_CHANNELS constant, and the test exercises BOUNDARY
 * input validation (renderers cannot exercise the inner handlers
 * with malformed payloads).
 */

type IpcHandler = (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown;

interface RegisteredHandlers {
  signIn: IpcHandler;
  signOut: IpcHandler;
  getCurrentSession: IpcHandler;
  reportActivity: IpcHandler;
}

function makeIpcMain(): {
  ipcMain: IpcMain;
  handlers: Map<string, IpcHandler>;
  handle: ReturnType<typeof vi.fn>;
} {
  const handlers = new Map<string, IpcHandler>();
  const handle = vi.fn((channel: string, fn: IpcHandler) => {
    handlers.set(channel, fn);
  });
  const ipcMain = { handle } as unknown as IpcMain;
  return { ipcMain, handlers, handle };
}

function fakeSignInHandler(result: SignInResponse | (() => SignInResponse)): SignInHandler {
  const signIn = vi.fn(() => {
    if (typeof result === 'function') {
      return Promise.resolve().then(() => result());
    }
    return Promise.resolve(result);
  });
  return { signIn } as unknown as SignInHandler;
}

function fakeSignOutHandler(result: SignOutResponse): SignOutHandler {
  const signOut = vi.fn(() => Promise.resolve(result));
  return { signOut } as unknown as SignOutHandler;
}

function fakeSessionManager(view: OperatorSessionBridgeView | null): SessionManager {
  const getCurrentBridgeView = vi.fn(() => view);
  return { getCurrentBridgeView } as unknown as SessionManager;
}

function fakeInactivityMonitor(): {
  monitor: InactivityMonitor;
  reportActivity: ReturnType<typeof vi.fn>;
} {
  const reportActivity = vi.fn();
  const monitor = { reportActivity } as unknown as InactivityMonitor;
  return { monitor, reportActivity };
}

function fakeAuditEmitter(): AuditEmitter {
  return { emit: vi.fn() } as unknown as AuditEmitter;
}

function fakeRosterHandler(): RosterHandler {
  return {
    listRoster: vi.fn(() => Promise.resolve({ kind: 'roster' as const, cashiers: [] })),
  } as unknown as RosterHandler;
}

function fakePairingStore(): PairingStore {
  const store: PairingStore = {
    getStatus: vi.fn(() => Promise.resolve({ kind: 'unpaired' as const })),
    persist: vi.fn(),
    clear: vi.fn(),
  };
  return store;
}

function fakeCashierSignInHandler(): CashierSignInHandler {
  return {
    signIn: vi.fn(() =>
      Promise.resolve({ kind: 'refused' as const, category: 'invalid_input' as const }),
    ),
  } as unknown as CashierSignInHandler;
}

function fakeTakeoverHandler(): TakeoverHandler {
  return {
    confirmTakeover: vi.fn(() =>
      Promise.resolve({ kind: 'refused' as const, category: 'invalid_input' as const }),
    ),
    cancelTakeover: vi.fn(() => Promise.resolve({ kind: 'cancelled' as const })),
  } as unknown as TakeoverHandler;
}

function register(opts: {
  signIn?: SignInResponse | (() => SignInResponse) | (() => never);
  signOut?: SignOutResponse;
  view?: OperatorSessionBridgeView | null;
}): {
  handlers: RegisteredHandlers;
  reportActivity: ReturnType<typeof vi.fn>;
} {
  const { ipcMain, handlers } = makeIpcMain();
  const sessionManager = fakeSessionManager(opts.view ?? null);
  const inactivity = fakeInactivityMonitor();
  registerOperatorHandlers(ipcMain, {
    signInHandler: fakeSignInHandler(opts.signIn ?? { kind: 'refused', category: 'invalid_input' }),
    cashierSignInHandler: fakeCashierSignInHandler(),
    signOutHandler: fakeSignOutHandler(opts.signOut ?? { kind: 'signed_out' }),
    rosterHandler: fakeRosterHandler(),
    sessionManager,
    inactivityMonitor: inactivity.monitor,
    auditEmitter: fakeAuditEmitter(),
    pairingStore: fakePairingStore(),
    takeoverHandler: fakeTakeoverHandler(),
  });
  const get = (channel: string): IpcHandler => {
    const fn = handlers.get(channel);
    if (fn === undefined) throw new Error(`channel ${channel} not registered`);
    return fn;
  };
  return {
    handlers: {
      signIn: get(OPERATOR_IPC_CHANNELS.SIGN_IN),
      signOut: get(OPERATOR_IPC_CHANNELS.SIGN_OUT),
      getCurrentSession: get(OPERATOR_IPC_CHANNELS.GET_CURRENT_SESSION),
      reportActivity: get(OPERATOR_IPC_CHANNELS.REPORT_ACTIVITY),
    },
    reportActivity: inactivity.reportActivity,
  };
}

const SAMPLE_VIEW: OperatorSessionBridgeView = {
  id: 'sess-1',
  operator_id: 'op-1',
  display_name: 'Manager',
  role: 'manager',
  tenant_id: 't1',
  branch_id: 'b1',
  started_at: '2026-05-06T00:00:00.000Z',
};

const FAKE_EVENT = {} as IpcMainInvokeEvent;

describe('registerOperatorHandlers — channel registration', () => {
  it('registers all nine operator:* channels exactly once', () => {
    const { ipcMain, handle } = makeIpcMain();
    registerOperatorHandlers(ipcMain, {
      signInHandler: fakeSignInHandler({ kind: 'refused', category: 'invalid_input' }),
      cashierSignInHandler: fakeCashierSignInHandler(),
      signOutHandler: fakeSignOutHandler({ kind: 'signed_out' }),
      rosterHandler: fakeRosterHandler(),
      sessionManager: fakeSessionManager(null),
      inactivityMonitor: fakeInactivityMonitor().monitor,
      auditEmitter: fakeAuditEmitter(),
      pairingStore: fakePairingStore(),
      takeoverHandler: fakeTakeoverHandler(),
    });
    const registered = handle.mock.calls.map((c) => c[0] as string);
    expect(registered).toContain(OPERATOR_IPC_CHANNELS.SIGN_IN);
    expect(registered).toContain(OPERATOR_IPC_CHANNELS.SIGN_OUT);
    expect(registered).toContain(OPERATOR_IPC_CHANNELS.GET_CURRENT_SESSION);
    expect(registered).toContain(OPERATOR_IPC_CHANNELS.REPORT_ACTIVITY);
    expect(registered).toContain(OPERATOR_IPC_CHANNELS.EMIT_AUDIT_EVENT);
    expect(registered).toContain(OPERATOR_IPC_CHANNELS.EMIT_AUDIT_EVENT_SMOKE);
    expect(registered).toContain(OPERATOR_IPC_CHANNELS.LIST_BRANCH_ROSTER);
    expect(registered).toContain(OPERATOR_IPC_CHANNELS.TAKEOVER_CONFIRM);
    expect(registered).toContain(OPERATOR_IPC_CHANNELS.TAKEOVER_CANCEL);
    // Each channel registered exactly once.
    for (const channel of registered) {
      expect(registered.filter((c) => c === channel)).toHaveLength(1);
    }
  });
});

describe('operator:sign-in boundary input validation', () => {
  it('refuses generically when the payload is not an object', async () => {
    const { handlers } = register({});
    for (const bad of [null, undefined, 'string', 42, true]) {
      const res = await handlers.signIn(FAKE_EVENT, bad);
      expect(res).toEqual({ kind: 'refused', category: 'invalid_input' });
    }
  });

  it('refuses generically when kind is wrong or missing', async () => {
    const { handlers } = register({});
    for (const bad of [
      {},
      { kind: 'cashier', cashier_id: 'op', pin: '1234' },
      { kind: 'manager_admin' },
      { kind: 'manager_admin', identifier: 42, password: 'p' },
      { kind: 'manager_admin', identifier: 'i', password: null },
    ]) {
      const res = await handlers.signIn(FAKE_EVENT, bad);
      expect(res).toEqual({ kind: 'refused', category: 'invalid_input' });
    }
  });

  it('forwards a well-formed manager_admin request to the inner handler', async () => {
    const { handlers } = register({
      signIn: { kind: 'signed_in', session: SAMPLE_VIEW },
    });
    const res = await handlers.signIn(FAKE_EVENT, {
      kind: 'manager_admin',
      identifier: 'manager@x.test',
      password: 'p',
    });
    expect(res).toEqual({ kind: 'signed_in', session: SAMPLE_VIEW });
  });

  it('maps OperatorRefusalError thrown from inner handler to a typed refusal', async () => {
    const { handlers } = register({
      signIn: () => {
        throw new OperatorRefusalError('role_mismatch');
      },
    });
    const res = await handlers.signIn(FAKE_EVENT, {
      kind: 'manager_admin',
      identifier: 'i',
      password: 'p',
    });
    expect(res).toEqual({ kind: 'refused', category: 'role_mismatch' });
  });

  it('maps any other thrown error to a generic refusal (no message echo)', async () => {
    const { handlers } = register({
      signIn: () => {
        throw new Error('SHOULD-NOT-CROSS-BRIDGE');
      },
    });
    const res = await handlers.signIn(FAKE_EVENT, {
      kind: 'manager_admin',
      identifier: 'i',
      password: 'p',
    });
    expect(res).toEqual({ kind: 'refused', category: 'invalid_input' });
    // Defence in depth: the thrown message MUST NOT appear in the result.
    expect(JSON.stringify(res)).not.toContain('SHOULD-NOT-CROSS-BRIDGE');
  });
});

describe('operator:sign-out', () => {
  it('forwards to the sign-out handler', async () => {
    const { handlers } = register({ signOut: { kind: 'signed_out' } });
    const res = await handlers.signOut(FAKE_EVENT);
    expect(res).toEqual({ kind: 'signed_out' });
  });
});

describe('operator:get-current-session', () => {
  it('returns null when no session is active', async () => {
    const { handlers } = register({ view: null });
    expect(await handlers.getCurrentSession(FAKE_EVENT)).toBeNull();
  });

  it('returns the bridge view when a session is active', async () => {
    const { handlers } = register({ view: SAMPLE_VIEW });
    expect(await handlers.getCurrentSession(FAKE_EVENT)).toEqual(SAMPLE_VIEW);
  });
});

describe('operator:_report-activity', () => {
  it('forwards to the inactivity monitor', async () => {
    const { handlers, reportActivity } = register({});
    await handlers.reportActivity(FAKE_EVENT);
    expect(reportActivity).toHaveBeenCalledTimes(1);
  });
});

// ─── Takeover confirm / cancel IPC boundary tests ──────────────────────────

function makeTakeoverHandler(opts: { confirmResult?: object; shouldThrow?: boolean }): {
  handler: TakeoverHandler;
  confirmFn: ReturnType<typeof vi.fn>;
} {
  const confirmFn = vi.fn(() => {
    if (opts.shouldThrow) throw new Error('unexpected inner error');
    return Promise.resolve(
      opts.confirmResult ?? { kind: 'refused' as const, category: 'invalid_input' as const },
    );
  });
  const handler = {
    confirmTakeover: confirmFn,
    cancelTakeover: vi.fn(() => Promise.resolve({ kind: 'cancelled' as const })),
  } as unknown as TakeoverHandler;
  return { handler, confirmFn };
}

function getHandler(handlers: Map<string, IpcHandler>, channel: string): IpcHandler {
  const fn = handlers.get(channel);
  if (fn === undefined) throw new Error(`channel ${channel} not registered`);
  return fn;
}

function registerWithTakeover(takeoverHandler: TakeoverHandler): Map<string, IpcHandler> {
  const { ipcMain, handlers } = makeIpcMain();
  registerOperatorHandlers(ipcMain, {
    signInHandler: fakeSignInHandler({ kind: 'refused', category: 'invalid_input' }),
    cashierSignInHandler: fakeCashierSignInHandler(),
    signOutHandler: fakeSignOutHandler({ kind: 'signed_out' }),
    rosterHandler: fakeRosterHandler(),
    sessionManager: fakeSessionManager(null),
    inactivityMonitor: fakeInactivityMonitor().monitor,
    auditEmitter: fakeAuditEmitter(),
    pairingStore: fakePairingStore(),
    takeoverHandler,
  });
  return handlers;
}

describe('operator:takeover-confirm — boundary input validation', () => {
  it('refuses invalid_input when request is not an object', async () => {
    const { handler } = makeTakeoverHandler({});
    const handlers = registerWithTakeover(handler);
    const confirmChannel = getHandler(handlers, OPERATOR_IPC_CHANNELS.TAKEOVER_CONFIRM);
    for (const bad of [null, undefined, 'string', 42, true]) {
      const res = await confirmChannel(FAKE_EVENT, bad);
      expect(res).toEqual({ kind: 'refused', category: 'invalid_input' });
    }
  });

  it('refuses invalid_input when pending_takeover_id is missing or empty', async () => {
    const { handler } = makeTakeoverHandler({});
    const handlers = registerWithTakeover(handler);
    const confirmChannel = getHandler(handlers, OPERATOR_IPC_CHANNELS.TAKEOVER_CONFIRM);
    for (const bad of [{}, { pending_takeover_id: '' }, { pending_takeover_id: 42 }]) {
      const res = await confirmChannel(FAKE_EVENT, bad);
      expect(res).toEqual({ kind: 'refused', category: 'invalid_input' });
    }
  });

  it('forwards a well-formed request to takeoverHandler.confirmTakeover', async () => {
    const successResult = {
      kind: 'signed_in' as const,
      session: SAMPLE_VIEW,
    };
    const { handler, confirmFn } = makeTakeoverHandler({ confirmResult: successResult });
    const handlers = registerWithTakeover(handler);
    const confirmChannel = getHandler(handlers, OPERATOR_IPC_CHANNELS.TAKEOVER_CONFIRM);
    const res = await confirmChannel(FAKE_EVENT, { pending_takeover_id: 'tok-uuid-001' });
    expect(res).toEqual(successResult);
    expect(confirmFn).toHaveBeenCalledWith({ pending_takeover_id: 'tok-uuid-001' });
  });

  it('maps unexpected inner throws to a generic invalid_input refusal', async () => {
    const { handler } = makeTakeoverHandler({ shouldThrow: true });
    const handlers = registerWithTakeover(handler);
    const confirmChannel = getHandler(handlers, OPERATOR_IPC_CHANNELS.TAKEOVER_CONFIRM);
    const res = await confirmChannel(FAKE_EVENT, { pending_takeover_id: 'tok-uuid-002' });
    expect(res).toEqual({ kind: 'refused', category: 'invalid_input' });
  });
});

// ─── Pre-sign-in roster (T070b contract fix) ──────────────────────────────────

function makePairedPairingStore(
  branch_id = 'branch-roster-1',
  cashiers?: BranchRosterCashier[],
): {
  pairingStore: PairingStore;
  rosterHandler: RosterHandler;
} {
  const pairingStore: PairingStore = {
    getStatus: vi.fn(() =>
      Promise.resolve({
        kind: 'paired' as const,
        tenant_id: 'tenant-1',
        branch_id,
        terminal_id: 'term-1',
        terminal_label: 'Counter',
        paired_at: 1735689600,
      }),
    ),
    persist: vi.fn(),
    clear: vi.fn(),
  };
  const resolvedCashiers: BranchRosterCashier[] = cashiers ?? [
    { id: 'cashier-1', display_name: 'Alice', role: 'cashier' as const },
  ];
  const rosterHandler: RosterHandler = {
    listRoster: vi.fn(() =>
      Promise.resolve({ kind: 'roster' as const, cashiers: resolvedCashiers }),
    ),
  } as unknown as RosterHandler;
  return { pairingStore, rosterHandler };
}

function registerWithPairingStore(
  pairingStore: PairingStore,
  rosterHandler?: RosterHandler,
): Map<string, IpcHandler> {
  const { ipcMain, handlers } = makeIpcMain();
  registerOperatorHandlers(ipcMain, {
    signInHandler: fakeSignInHandler({ kind: 'refused', category: 'invalid_input' }),
    cashierSignInHandler: fakeCashierSignInHandler(),
    signOutHandler: fakeSignOutHandler({ kind: 'signed_out' }),
    rosterHandler:
      rosterHandler ??
      ({
        listRoster: vi.fn(() => Promise.resolve({ kind: 'roster', cashiers: [] })),
      } as unknown as RosterHandler),
    sessionManager: fakeSessionManager(null),
    inactivityMonitor: fakeInactivityMonitor().monitor,
    auditEmitter: fakeAuditEmitter(),
    pairingStore,
    takeoverHandler: fakeTakeoverHandler(),
  });
  return handlers;
}

describe('operator:list-branch-roster — pre-sign-in access', () => {
  it('returns roster when terminal is paired and no operator session exists', async () => {
    const { pairingStore, rosterHandler } = makePairedPairingStore('branch-1');
    const handlers = registerWithPairingStore(pairingStore, rosterHandler);
    const rosterChannel = getHandler(handlers, OPERATOR_IPC_CHANNELS.LIST_BRANCH_ROSTER);
    const res = (await rosterChannel(FAKE_EVENT)) as ListBranchRosterResponse;
    expect(res.kind).toBe('roster');
  });

  it('passes branch_id from pairing state to rosterHandler (no session)', async () => {
    const { pairingStore, rosterHandler } = makePairedPairingStore('branch-999');
    const handlers = registerWithPairingStore(pairingStore, rosterHandler);
    const rosterChannel = getHandler(handlers, OPERATOR_IPC_CHANNELS.LIST_BRANCH_ROSTER);
    await rosterChannel(FAKE_EVENT);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(rosterHandler.listRoster).toHaveBeenCalledWith('branch-999');
  });

  it('refuses with invalid_input when terminal is unpaired', async () => {
    const unpaired: PairingStore = {
      getStatus: vi.fn(() => Promise.resolve({ kind: 'unpaired' as const })),
      persist: vi.fn(),
      clear: vi.fn(),
    };
    const handlers = registerWithPairingStore(unpaired);
    const rosterChannel = getHandler(handlers, OPERATOR_IPC_CHANNELS.LIST_BRANCH_ROSTER);
    const res = await rosterChannel(FAKE_EVENT);
    expect(res).toEqual({ kind: 'refused', category: 'invalid_input' });
  });

  it('response roster contains only minimum-disclosure fields (no email/phone/PIN fields)', async () => {
    const cashiersFromBackend: BranchRosterCashier[] = [
      { id: 'c-1', display_name: 'Bob', role: 'cashier' as const },
    ];
    const { pairingStore, rosterHandler } = makePairedPairingStore('branch-1', cashiersFromBackend);
    const handlers = registerWithPairingStore(pairingStore, rosterHandler);
    const rosterChannel = getHandler(handlers, OPERATOR_IPC_CHANNELS.LIST_BRANCH_ROSTER);
    const res = (await rosterChannel(FAKE_EVENT)) as ListBranchRosterResponse;
    const serialised = JSON.stringify(res);
    expect(serialised).not.toContain('email');
    expect(serialised).not.toContain('phone');
    expect(serialised).not.toContain('pin');
    expect(serialised).not.toContain('password');
  });
});

describe('operator:takeover-cancel — boundary behaviour', () => {
  it('returns cancelled when request is not an object (lenient — always cancels)', async () => {
    const { handler } = makeTakeoverHandler({});
    const handlers = registerWithTakeover(handler);
    const cancelChannel = getHandler(handlers, OPERATOR_IPC_CHANNELS.TAKEOVER_CANCEL);
    for (const bad of [null, undefined, 'string', 42]) {
      const res = await cancelChannel(FAKE_EVENT, bad);
      expect(res).toEqual({ kind: 'cancelled' });
    }
  });

  it('forwards a well-formed cancel request to takeoverHandler.cancelTakeover', async () => {
    const { handler } = makeTakeoverHandler({});
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const cancelFn = handler.cancelTakeover as ReturnType<typeof vi.fn>;
    const handlers = registerWithTakeover(handler);
    const cancelChannel = getHandler(handlers, OPERATOR_IPC_CHANNELS.TAKEOVER_CANCEL);
    const res = await cancelChannel(FAKE_EVENT, { pending_takeover_id: 'tok-uuid-003' });
    expect(res).toEqual({ kind: 'cancelled' });
    expect(cancelFn).toHaveBeenCalledWith({ pending_takeover_id: 'tok-uuid-003' });
  });
});

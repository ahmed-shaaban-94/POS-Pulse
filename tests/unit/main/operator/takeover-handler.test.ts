import { beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';

import {
  TakeoverHandler,
  ProtoSessionStore,
  type ProtoSession,
} from '../../../../src/main/operator/takeover-handler.js';
import type { SessionManager } from '../../../../src/main/operator/session-manager.js';
import type { BackendClient } from '../../../../src/main/operator/backend-client.js';
import type { JwtHolder } from '../../../../src/main/operator/jwt-holder.js';
import type { AuditEmitter } from '../../../../src/main/audit/audit-emitter.js';
import type { PairingStore } from '../../../../src/main/pairing/store.js';

// --- helpers ---

function makePairedStore(terminal_id = 'term-1'): PairingStore {
  return {
    getStatus: vi.fn(() =>
      Promise.resolve({
        kind: 'paired' as const,
        tenant_id: 't1',
        branch_id: 'b1',
        terminal_id,
        terminal_label: 'T1',
        paired_at: 0,
      }),
    ),
    persist: vi.fn(() => Promise.resolve()),
    clear: vi.fn(() => Promise.resolve()),
  };
}

function makeSessionManager(): SessionManager {
  let current: ReturnType<SessionManager['getCurrent']> = null;
  return {
    create: vi.fn((input) => {
      const record = {
        id: randomUUID(),
        operator_id: input.operator_id,
        display_name: input.display_name,
        role: input.role,
        tenant_id: input.tenant_id,
        branch_id: input.branch_id,
        backend_session_id: input.backend_session_id,
        started_at: input.started_at ?? new Date().toISOString(),
        last_activity_at: new Date().toISOString(),
      };
      current = record;
      return record;
    }),
    end: vi.fn(() => {
      current = null;
    }),
    getCurrent: vi.fn(() => current),
    getCurrentBridgeView: vi.fn(() => null),
    reportActivity: vi.fn(),
  } as unknown as SessionManager;
}

function makeBackend(
  kind: 'signed_in' | 'refused' | 'no_connection' = 'signed_in',
): BackendClient {
  const signedInResponse =
    kind === 'signed_in'
      ? {
          kind: 'signed_in' as const,
          operator: {
            id: 'op-mgr-001',
            display_name: 'Manager One',
            role: 'manager' as const,
            tenant_id: 't1',
            branch_id: 'b1',
          },
          operator_session: { id: 'bss-001', issued_at: new Date().toISOString() },
        }
      : null;

  return {
    signIn: vi.fn(() => Promise.resolve({ kind: 'refused' as const })),
    signOut: vi.fn(() => Promise.resolve({ kind: 'refused' as const })),
    listRoster: vi.fn(() => Promise.resolve({ kind: 'refused' as const })),
    confirmTakeover: vi.fn(() =>
      Promise.resolve(kind === 'signed_in' ? signedInResponse : { kind }),
    ),
    getActiveSession: vi.fn(() => Promise.resolve({ kind: 'none' as const })),
  } as unknown as BackendClient;
}

function makeJwtHolder(): JwtHolder {
  const store = new Map<string, string>();
  return {
    set: vi.fn((id: string, jwt: string) => store.set(id, jwt)),
    get: vi.fn((id: string) => store.get(id) ?? null),
    clear: vi.fn((id: string) => store.delete(id)),
  } as unknown as JwtHolder;
}

function makeAuditEmitter(): AuditEmitter {
  return { emit: vi.fn() } as unknown as AuditEmitter;
}

function makeProtoStore(): ProtoSessionStore {
  return new ProtoSessionStore();
}

function buildManagerProto(overrides: Partial<ProtoSession> = {}): ProtoSession {
  return {
    pending_takeover_id: randomUUID(),
    operator_id: 'op-mgr-001',
    display_name: 'Manager One',
    role: 'manager',
    tenant_id: 't1',
    branch_id: 'b1',
    jwt: 'clerk-jwt-token',
    created_at: Date.now(),
    ...overrides,
  };
}

function buildCashierProto(overrides: Partial<ProtoSession> = {}): ProtoSession {
  return {
    pending_takeover_id: randomUUID(),
    operator_id: 'cashier-001',
    display_name: 'Jane Cashier',
    role: 'cashier',
    tenant_id: 't1',
    branch_id: 'b1',
    jwt: null,
    created_at: Date.now(),
    ...overrides,
  };
}

// --- tests ---

describe('TakeoverHandler — confirmTakeover: invalid/missing pending_takeover_id', () => {
  it('returns refused/invalid_input for empty string id', async () => {
    const store = makeProtoStore();
    const handler = new TakeoverHandler({
      protoStore: store,
      sessionManager: makeSessionManager(),
      backend: makeBackend(),
      jwtHolder: makeJwtHolder(),
      auditEmitter: makeAuditEmitter(),
      pairingStore: makePairedStore(),
      deviceTokenAttestation: () => 'att-token',
    });
    const result = await handler.confirmTakeover({ pending_takeover_id: '' });
    expect(result).toEqual({ kind: 'refused', category: 'invalid_input' });
  });

  it('returns refused/invalid_input when id not in store', async () => {
    const store = makeProtoStore();
    const handler = new TakeoverHandler({
      protoStore: store,
      sessionManager: makeSessionManager(),
      backend: makeBackend(),
      jwtHolder: makeJwtHolder(),
      auditEmitter: makeAuditEmitter(),
      pairingStore: makePairedStore(),
      deviceTokenAttestation: () => 'att-token',
    });
    const result = await handler.confirmTakeover({ pending_takeover_id: randomUUID() });
    expect(result).toEqual({ kind: 'refused', category: 'invalid_input' });
  });

  it('returns refused/invalid_input for expired proto-session', async () => {
    const store = makeProtoStore();
    const proto = buildManagerProto({ created_at: Date.now() - 61_000 }); // expired
    store.set(proto);
    const handler = new TakeoverHandler({
      protoStore: store,
      sessionManager: makeSessionManager(),
      backend: makeBackend(),
      jwtHolder: makeJwtHolder(),
      auditEmitter: makeAuditEmitter(),
      pairingStore: makePairedStore(),
      deviceTokenAttestation: () => 'att-token',
    });
    const result = await handler.confirmTakeover({
      pending_takeover_id: proto.pending_takeover_id,
    });
    expect(result).toEqual({ kind: 'refused', category: 'invalid_input' });
  });
});

describe('TakeoverHandler — confirmTakeover: manager/admin path (backend called)', () => {
  it('returns signed_in with correct session shape on backend success', async () => {
    const store = makeProtoStore();
    const proto = buildManagerProto();
    store.set(proto);
    const sm = makeSessionManager();
    const handler = new TakeoverHandler({
      protoStore: store,
      sessionManager: sm,
      backend: makeBackend('signed_in'),
      jwtHolder: makeJwtHolder(),
      auditEmitter: makeAuditEmitter(),
      pairingStore: makePairedStore(),
      deviceTokenAttestation: () => 'att-token',
    });
    const result = await handler.confirmTakeover({
      pending_takeover_id: proto.pending_takeover_id,
    });
    expect(result.kind).toBe('signed_in');
    if (result.kind !== 'signed_in') return;
    expect(result.session.role).toBe('manager');
    expect(result.session.operator_id).toBe('op-mgr-001');
  });

  it('emits operator.session.takeover audit event on success', async () => {
    const store = makeProtoStore();
    const proto = buildManagerProto();
    store.set(proto);
    const auditEmitter = makeAuditEmitter();
    const handler = new TakeoverHandler({
      protoStore: store,
      sessionManager: makeSessionManager(),
      backend: makeBackend('signed_in'),
      jwtHolder: makeJwtHolder(),
      auditEmitter,
      pairingStore: makePairedStore(),
      deviceTokenAttestation: () => 'att-token',
    });
    await handler.confirmTakeover({ pending_takeover_id: proto.pending_takeover_id });
    expect(auditEmitter.emit).toHaveBeenCalledOnce();
    const emittedEvent = (auditEmitter.emit as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(emittedEvent?.action_category).toBe('operator.session.takeover');
  });

  it('discards proto-session after successful confirm (idempotency: second call returns invalid_input)', async () => {
    const store = makeProtoStore();
    const proto = buildManagerProto();
    store.set(proto);
    const handler = new TakeoverHandler({
      protoStore: store,
      sessionManager: makeSessionManager(),
      backend: makeBackend('signed_in'),
      jwtHolder: makeJwtHolder(),
      auditEmitter: makeAuditEmitter(),
      pairingStore: makePairedStore(),
      deviceTokenAttestation: () => 'att-token',
    });
    await handler.confirmTakeover({ pending_takeover_id: proto.pending_takeover_id });
    const second = await handler.confirmTakeover({
      pending_takeover_id: proto.pending_takeover_id,
    });
    expect(second).toEqual({ kind: 'refused', category: 'invalid_input' });
  });

  it('returns refused/no_connection and retains proto-session on backend no_connection', async () => {
    const store = makeProtoStore();
    const proto = buildManagerProto();
    store.set(proto);
    const handler = new TakeoverHandler({
      protoStore: store,
      sessionManager: makeSessionManager(),
      backend: makeBackend('no_connection'),
      jwtHolder: makeJwtHolder(),
      auditEmitter: makeAuditEmitter(),
      pairingStore: makePairedStore(),
      deviceTokenAttestation: () => 'att-token',
    });
    const result = await handler.confirmTakeover({
      pending_takeover_id: proto.pending_takeover_id,
    });
    expect(result).toEqual({ kind: 'refused', category: 'no_connection' });
    // Proto-session retained → retry is possible
    const retry = await handler.confirmTakeover({
      pending_takeover_id: proto.pending_takeover_id,
    });
    // retry still hits backend (backend still returns no_connection in this test)
    expect(retry).toEqual({ kind: 'refused', category: 'no_connection' });
  });

  it('returns refused/invalid_input and discards proto-session on backend refused', async () => {
    const store = makeProtoStore();
    const proto = buildManagerProto();
    store.set(proto);
    const handler = new TakeoverHandler({
      protoStore: store,
      sessionManager: makeSessionManager(),
      backend: makeBackend('refused'),
      jwtHolder: makeJwtHolder(),
      auditEmitter: makeAuditEmitter(),
      pairingStore: makePairedStore(),
      deviceTokenAttestation: () => 'att-token',
    });
    const result = await handler.confirmTakeover({
      pending_takeover_id: proto.pending_takeover_id,
    });
    expect(result).toEqual({ kind: 'refused', category: 'invalid_input' });
    // Proto discarded → second call also invalid_input
    expect(store.get(proto.pending_takeover_id)).toBeUndefined();
  });
});

describe('TakeoverHandler — confirmTakeover: cashier path (backend skipped)', () => {
  it('returns signed_in without calling backend.confirmTakeover for cashier role', async () => {
    const store = makeProtoStore();
    const proto = buildCashierProto();
    store.set(proto);
    const backend = makeBackend('signed_in');
    const handler = new TakeoverHandler({
      protoStore: store,
      sessionManager: makeSessionManager(),
      backend,
      jwtHolder: makeJwtHolder(),
      auditEmitter: makeAuditEmitter(),
      pairingStore: makePairedStore(),
      deviceTokenAttestation: () => 'att-token',
    });
    const result = await handler.confirmTakeover({
      pending_takeover_id: proto.pending_takeover_id,
    });
    expect(result.kind).toBe('signed_in');
    expect(backend.confirmTakeover).not.toHaveBeenCalled();
  });

  it('emits audit event for cashier takeover confirm', async () => {
    const store = makeProtoStore();
    const proto = buildCashierProto();
    store.set(proto);
    const auditEmitter = makeAuditEmitter();
    const handler = new TakeoverHandler({
      protoStore: store,
      sessionManager: makeSessionManager(),
      backend: makeBackend(),
      jwtHolder: makeJwtHolder(),
      auditEmitter,
      pairingStore: makePairedStore(),
      deviceTokenAttestation: () => 'att-token',
    });
    await handler.confirmTakeover({ pending_takeover_id: proto.pending_takeover_id });
    expect(auditEmitter.emit).toHaveBeenCalledOnce();
    const emittedEvent = (auditEmitter.emit as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(emittedEvent?.action_category).toBe('operator.session.takeover');
  });
});

describe('TakeoverHandler — audit failure is best-effort', () => {
  it('still returns signed_in for manager path even when auditEmitter.emit throws', async () => {
    const store = makeProtoStore();
    const proto = buildManagerProto();
    store.set(proto);
    const throwingEmitter: AuditEmitter = {
      emit: vi.fn(() => {
        throw new Error('DB write failed');
      }),
    } as unknown as AuditEmitter;
    const handler = new TakeoverHandler({
      protoStore: store,
      sessionManager: makeSessionManager(),
      backend: makeBackend('signed_in'),
      jwtHolder: makeJwtHolder(),
      auditEmitter: throwingEmitter,
      pairingStore: makePairedStore(),
      deviceTokenAttestation: () => 'att-token',
    });
    const result = await handler.confirmTakeover({
      pending_takeover_id: proto.pending_takeover_id,
    });
    // Audit failure must not abort the sign-in flow (best-effort per class-level JSDoc).
    expect(result.kind).toBe('signed_in');
  });

  it('still returns signed_in for cashier path even when auditEmitter.emit throws', async () => {
    const store = makeProtoStore();
    const proto = buildCashierProto();
    store.set(proto);
    const throwingEmitter: AuditEmitter = {
      emit: vi.fn(() => {
        throw new Error('DB write failed');
      }),
    } as unknown as AuditEmitter;
    const handler = new TakeoverHandler({
      protoStore: store,
      sessionManager: makeSessionManager(),
      backend: makeBackend(),
      jwtHolder: makeJwtHolder(),
      auditEmitter: throwingEmitter,
      pairingStore: makePairedStore(),
      deviceTokenAttestation: () => 'att-token',
    });
    const result = await handler.confirmTakeover({
      pending_takeover_id: proto.pending_takeover_id,
    });
    expect(result.kind).toBe('signed_in');
  });
});

describe('TakeoverHandler — cancelTakeover', () => {
  it('returns { kind: "cancelled" } for a valid pending id', async () => {
    const store = makeProtoStore();
    const proto = buildManagerProto();
    store.set(proto);
    const handler = new TakeoverHandler({
      protoStore: store,
      sessionManager: makeSessionManager(),
      backend: makeBackend(),
      jwtHolder: makeJwtHolder(),
      auditEmitter: makeAuditEmitter(),
      pairingStore: makePairedStore(),
      deviceTokenAttestation: () => 'att-token',
    });
    const result = await handler.cancelTakeover({
      pending_takeover_id: proto.pending_takeover_id,
    });
    expect(result).toEqual({ kind: 'cancelled' });
  });

  it('returns { kind: "cancelled" } idempotently for an unknown id (already cancelled or never existed)', async () => {
    const store = makeProtoStore();
    const handler = new TakeoverHandler({
      protoStore: store,
      sessionManager: makeSessionManager(),
      backend: makeBackend(),
      jwtHolder: makeJwtHolder(),
      auditEmitter: makeAuditEmitter(),
      pairingStore: makePairedStore(),
      deviceTokenAttestation: () => 'att-token',
    });
    const result = await handler.cancelTakeover({ pending_takeover_id: randomUUID() });
    expect(result).toEqual({ kind: 'cancelled' });
  });

  it('discards the proto-session on cancel (store is empty after cancel)', async () => {
    const store = makeProtoStore();
    const proto = buildManagerProto();
    store.set(proto);
    const handler = new TakeoverHandler({
      protoStore: store,
      sessionManager: makeSessionManager(),
      backend: makeBackend(),
      jwtHolder: makeJwtHolder(),
      auditEmitter: makeAuditEmitter(),
      pairingStore: makePairedStore(),
      deviceTokenAttestation: () => 'att-token',
    });
    await handler.cancelTakeover({ pending_takeover_id: proto.pending_takeover_id });
    expect(store.get(proto.pending_takeover_id)).toBeUndefined();
  });

  it('does not emit an audit event on cancel', async () => {
    const store = makeProtoStore();
    const proto = buildManagerProto();
    store.set(proto);
    const auditEmitter = makeAuditEmitter();
    const handler = new TakeoverHandler({
      protoStore: store,
      sessionManager: makeSessionManager(),
      backend: makeBackend(),
      jwtHolder: makeJwtHolder(),
      auditEmitter,
      pairingStore: makePairedStore(),
      deviceTokenAttestation: () => 'att-token',
    });
    await handler.cancelTakeover({ pending_takeover_id: proto.pending_takeover_id });
    expect(auditEmitter.emit).not.toHaveBeenCalled();
  });

  it('does not change the active session on cancel', async () => {
    const store = makeProtoStore();
    const proto = buildManagerProto();
    store.set(proto);
    const sm = makeSessionManager();
    const handler = new TakeoverHandler({
      protoStore: store,
      sessionManager: sm,
      backend: makeBackend(),
      jwtHolder: makeJwtHolder(),
      auditEmitter: makeAuditEmitter(),
      pairingStore: makePairedStore(),
      deviceTokenAttestation: () => 'att-token',
    });
    await handler.cancelTakeover({ pending_takeover_id: proto.pending_takeover_id });
    expect(sm.create).not.toHaveBeenCalled();
    expect(sm.end).not.toHaveBeenCalled();
  });
});

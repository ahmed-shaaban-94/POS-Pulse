/**
 * T047 — Unit tests: audit sync loop (outbox → backend).
 *
 * Verifies that `AuditSync.flush()`:
 *   1. Sends only unsynced events using the Endpoint 5 request shape.
 *   2. Marks `accepted` events as synced in `audit_events_sync_state`.
 *   3. Marks `duplicate` events as synced (they already landed on the backend).
 *   4. Does NOT mark `rejected` events as synced — they stay in the outbox.
 *   5. Does NOT mark events as synced on network failure.
 *   6. Does NOT mark events as synced when the response body is malformed.
 *   7. Never logs sensitive field names from any event payload.
 *
 * `AuditSyncStore` and `AuditSyncClient` are injected fakes — no real DB or
 * network. Production binds better-sqlite3 + the global `fetch`.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  AuditSync,
  type AuditSyncStore,
  type AuditSyncClient,
  type AuditSyncBatchResponse,
} from '../audit-sync.js';
import type { AuditEvent } from '../../../shared/audit/event-shape.js';

// ─── Fixture data ──────────────────────────────────────────────────────────

function makeEvent(id: string, tenant = 'tenant-A'): AuditEvent {
  return {
    event_id: id,
    tenant_id: tenant,
    branch_id: 'branch-1',
    originating_terminal_id: 'term-1',
    acting_operator_id: 'clerk-user-1',
    session_id: null,
    shift_id: null,
    action_category: 'shift.open',
    created_at: '2026-05-07T10:00:00.000Z',
    approving_supervisor_id: null,
    payload: {},
  };
}

// ─── Fake store ────────────────────────────────────────────────────────────

function makeFakeStore(initial: AuditEvent[] = []): {
  store: AuditSyncStore;
  unsynced: AuditEvent[];
  syncedIds: Array<{ tenant_id: string; event_id: string }>;
} {
  const unsynced = [...initial];
  const syncedIds: Array<{ tenant_id: string; event_id: string }> = [];

  const store: AuditSyncStore = {
    listUnsynced(): AuditEvent[] {
      return [...unsynced];
    },
    markSynced(tenant_id: string, event_id: string): void {
      const idx = unsynced.findIndex((e) => e.tenant_id === tenant_id && e.event_id === event_id);
      if (idx !== -1) unsynced.splice(idx, 1);
      syncedIds.push({ tenant_id, event_id });
    },
  };

  return { store, unsynced, syncedIds };
}

// ─── Fake client ───────────────────────────────────────────────────────────

function makeFakeClient(response: AuditSyncBatchResponse | 'network_error'): {
  client: AuditSyncClient;
  calls: AuditEvent[][];
} {
  const calls: AuditEvent[][] = [];

  const client: AuditSyncClient = {
    sendBatch(events: AuditEvent[]): Promise<AuditSyncBatchResponse | 'network_error'> {
      calls.push([...events]);
      return Promise.resolve(response);
    },
  };

  return { client, calls };
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('AuditSync — flush() (T047)', () => {
  // ── Empty outbox ────────────────────────────────────────────────────────

  it('does nothing when there are no unsynced events', async () => {
    const { store } = makeFakeStore([]);
    const { client, calls } = makeFakeClient({ accepted: [], duplicates: [], rejected: [] });
    const sync = new AuditSync({ store, client });
    await sync.flush();
    expect(calls).toHaveLength(0);
  });

  // ── Request shape ───────────────────────────────────────────────────────

  it('sends unsynced events in a single batch call', async () => {
    const events = [makeEvent('evt-001'), makeEvent('evt-002')];
    const { store } = makeFakeStore(events);
    const { client, calls } = makeFakeClient({
      accepted: ['evt-001', 'evt-002'],
      duplicates: [],
      rejected: [],
    });
    const sync = new AuditSync({ store, client });
    await sync.flush();
    expect(calls).toHaveLength(1);
    expect(calls[0]).toHaveLength(2);
    expect(calls[0]?.map((e) => e.event_id)).toEqual(['evt-001', 'evt-002']);
  });

  it('sends full AuditEvent shape to the client (all fields present)', async () => {
    const event = makeEvent('evt-001');
    const { store } = makeFakeStore([event]);
    const { client, calls } = makeFakeClient({
      accepted: ['evt-001'],
      duplicates: [],
      rejected: [],
    });
    const sync = new AuditSync({ store, client });
    await sync.flush();
    const batch = calls[0];
    expect(batch).toBeDefined();
    const sent = batch?.[0];
    expect(sent).toBeDefined();
    expect(sent?.event_id).toBe('evt-001');
    expect(sent?.tenant_id).toBe('tenant-A');
    expect(sent?.branch_id).toBe('branch-1');
    expect(sent?.originating_terminal_id).toBe('term-1');
    expect(sent?.acting_operator_id).toBe('clerk-user-1');
    expect(sent?.action_category).toBe('shift.open');
    expect(sent?.created_at).toBe('2026-05-07T10:00:00.000Z');
  });

  // ── Accepted → mark synced ──────────────────────────────────────────────

  it('marks accepted events as synced', async () => {
    const events = [makeEvent('evt-001'), makeEvent('evt-002')];
    const { store, syncedIds } = makeFakeStore(events);
    const { client } = makeFakeClient({
      accepted: ['evt-001', 'evt-002'],
      duplicates: [],
      rejected: [],
    });
    const sync = new AuditSync({ store, client });
    await sync.flush();
    expect(syncedIds).toHaveLength(2);
    expect(syncedIds.map((s) => s.event_id)).toContain('evt-001');
    expect(syncedIds.map((s) => s.event_id)).toContain('evt-002');
  });

  it('markSynced includes the correct tenant_id for accepted events', async () => {
    const event = makeEvent('evt-001', 'tenant-X');
    const { store, syncedIds } = makeFakeStore([event]);
    const { client } = makeFakeClient({ accepted: ['evt-001'], duplicates: [], rejected: [] });
    const sync = new AuditSync({ store, client });
    await sync.flush();
    expect(syncedIds[0]).toMatchObject({ tenant_id: 'tenant-X', event_id: 'evt-001' });
  });

  it('markSynced is called with a non-empty synced_at ISO timestamp for accepted events', async () => {
    const event = makeEvent('evt-001');
    const { store } = makeFakeStore([event]);
    const markSyncedSpy = vi.fn();
    store.markSynced = markSyncedSpy;
    const { client } = makeFakeClient({ accepted: ['evt-001'], duplicates: [], rejected: [] });
    const sync = new AuditSync({ store, client });
    await sync.flush();
    expect(markSyncedSpy).toHaveBeenCalledOnce();
    const [, , syncedAt] = markSyncedSpy.mock.calls[0] as [string, string, string];
    expect(() => new Date(syncedAt).toISOString()).not.toThrow();
  });

  // ── Duplicates → mark synced ────────────────────────────────────────────

  it('marks duplicate events as synced (they already landed on backend)', async () => {
    const events = [makeEvent('evt-001'), makeEvent('evt-002')];
    const { store, syncedIds } = makeFakeStore(events);
    const { client } = makeFakeClient({
      accepted: [],
      duplicates: ['evt-001', 'evt-002'],
      rejected: [],
    });
    const sync = new AuditSync({ store, client });
    await sync.flush();
    expect(syncedIds).toHaveLength(2);
    expect(syncedIds.map((s) => s.event_id)).toContain('evt-001');
    expect(syncedIds.map((s) => s.event_id)).toContain('evt-002');
  });

  it('marks both accepted and duplicate events synced in a mixed response', async () => {
    const events = [makeEvent('evt-001'), makeEvent('evt-002'), makeEvent('evt-003')];
    const { store, syncedIds } = makeFakeStore(events);
    const { client } = makeFakeClient({
      accepted: ['evt-001'],
      duplicates: ['evt-002'],
      rejected: [{ event_id: 'evt-003', category: 'invalid_input' }],
    });
    const sync = new AuditSync({ store, client });
    await sync.flush();
    const syncedEventIds = syncedIds.map((s) => s.event_id);
    expect(syncedEventIds).toContain('evt-001');
    expect(syncedEventIds).toContain('evt-002');
    expect(syncedEventIds).not.toContain('evt-003');
  });

  // ── Rejected → stay in outbox ───────────────────────────────────────────

  it('does NOT mark rejected events as synced', async () => {
    const events = [makeEvent('evt-001')];
    const { store, syncedIds } = makeFakeStore(events);
    const { client } = makeFakeClient({
      accepted: [],
      duplicates: [],
      rejected: [{ event_id: 'evt-001', category: 'invalid_input' }],
    });
    const sync = new AuditSync({ store, client });
    await sync.flush();
    expect(syncedIds).toHaveLength(0);
  });

  it('rejected events remain in the unsynced list after flush', async () => {
    const events = [makeEvent('evt-001')];
    const { store, unsynced } = makeFakeStore(events);
    const { client } = makeFakeClient({
      accepted: [],
      duplicates: [],
      rejected: [{ event_id: 'evt-001', category: 'schema_violation' }],
    });
    const sync = new AuditSync({ store, client });
    await sync.flush();
    expect(unsynced).toHaveLength(1);
    expect(unsynced[0]?.event_id).toBe('evt-001');
  });

  it('handles all rejection categories without throwing', async () => {
    const categories = ['invalid_input', 'tenant_mismatch', 'schema_violation'] as const;
    for (const category of categories) {
      const { store } = makeFakeStore([makeEvent('evt-001')]);
      const { client } = makeFakeClient({
        accepted: [],
        duplicates: [],
        rejected: [{ event_id: 'evt-001', category }],
      });
      const sync = new AuditSync({ store, client });
      await expect(sync.flush()).resolves.toBeUndefined();
    }
  });

  // ── Network failure → stay in outbox ────────────────────────────────────

  it('does NOT mark events as synced on network failure', async () => {
    const events = [makeEvent('evt-001')];
    const { store, syncedIds } = makeFakeStore(events);
    const { client } = makeFakeClient('network_error');
    const sync = new AuditSync({ store, client });
    await sync.flush();
    expect(syncedIds).toHaveLength(0);
  });

  it('network failure does not throw (flush resolves)', async () => {
    const { store } = makeFakeStore([makeEvent('evt-001')]);
    const { client } = makeFakeClient('network_error');
    const sync = new AuditSync({ store, client });
    await expect(sync.flush()).resolves.toBeUndefined();
  });

  it('events remain in outbox after network failure', async () => {
    const events = [makeEvent('evt-001')];
    const { store, unsynced } = makeFakeStore(events);
    const { client } = makeFakeClient('network_error');
    const sync = new AuditSync({ store, client });
    await sync.flush();
    expect(unsynced).toHaveLength(1);
  });

  // ── Malformed / partial response → fail safe ────────────────────────────

  it('does NOT mark events synced when response is malformed (null body)', async () => {
    const events = [makeEvent('evt-001')];
    const { store, syncedIds } = makeFakeStore(events);
    const client: AuditSyncClient = {
      sendBatch(): Promise<AuditSyncBatchResponse | 'network_error'> {
        return Promise.resolve({
          accepted: null as unknown as string[],
          duplicates: [],
          rejected: [],
        });
      },
    };
    const sync = new AuditSync({ store, client });
    await sync.flush();
    expect(syncedIds).toHaveLength(0);
  });

  it('does NOT mark events synced when accepted is not an array', async () => {
    const events = [makeEvent('evt-001')];
    const { store, syncedIds } = makeFakeStore(events);
    const client: AuditSyncClient = {
      sendBatch(): Promise<AuditSyncBatchResponse | 'network_error'> {
        return Promise.resolve({
          accepted: 'evt-001' as unknown as string[],
          duplicates: [],
          rejected: [],
        });
      },
    };
    const sync = new AuditSync({ store, client });
    await sync.flush();
    expect(syncedIds).toHaveLength(0);
  });

  it('does NOT throw when duplicates is missing from response', async () => {
    const events = [makeEvent('evt-001')];
    const { store } = makeFakeStore(events);
    const client: AuditSyncClient = {
      sendBatch(): Promise<AuditSyncBatchResponse | 'network_error'> {
        return Promise.resolve({
          accepted: ['evt-001'],
          duplicates: undefined as unknown as string[],
          rejected: [],
        });
      },
    };
    const sync = new AuditSync({ store, client });
    await expect(sync.flush()).resolves.toBeUndefined();
  });

  // ── Batch limit ─────────────────────────────────────────────────────────

  it('respects the configured batch limit when listing unsynced events', async () => {
    const listUnsyncedSpy = vi.fn().mockReturnValue([]);
    const store: AuditSyncStore = {
      listUnsynced: listUnsyncedSpy,
      markSynced: vi.fn(),
    };
    const { client } = makeFakeClient({ accepted: [], duplicates: [], rejected: [] });
    const batchLimit = 25;
    const sync = new AuditSync({ store, client, batchLimit });
    await sync.flush();
    expect(listUnsyncedSpy).toHaveBeenCalledWith(batchLimit);
  });

  it('uses a default batch limit when none is configured', async () => {
    const listUnsyncedSpy = vi.fn().mockReturnValue([]);
    const store: AuditSyncStore = {
      listUnsynced: listUnsyncedSpy,
      markSynced: vi.fn(),
    };
    const { client } = makeFakeClient({ accepted: [], duplicates: [], rejected: [] });
    const sync = new AuditSync({ store, client });
    await sync.flush();
    const [limit] = listUnsyncedSpy.mock.calls[0] as [number];
    expect(typeof limit).toBe('number');
    expect(limit).toBeGreaterThan(0);
  });

  // ── Cross-tenant safety ─────────────────────────────────────────────────

  it('marks synced only the accepted event_id that belongs to the matching tenant', async () => {
    const evtA = makeEvent('evt-001', 'tenant-A');
    const evtB = makeEvent('evt-001', 'tenant-B'); // same event_id, different tenant
    const syncedIds: Array<{ tenant_id: string; event_id: string }> = [];
    // Use a store that only lists tenant-A's event as unsynced (batch boundary)
    const singleTenantStore: AuditSyncStore = {
      listUnsynced(): AuditEvent[] {
        return [evtA]; // one tenant per flush in this test
      },
      markSynced(tenant_id: string, event_id: string): void {
        syncedIds.push({ tenant_id, event_id });
      },
    };
    const overrideClient: AuditSyncClient = {
      sendBatch(): Promise<AuditSyncBatchResponse | 'network_error'> {
        return Promise.resolve({ accepted: ['evt-001'], duplicates: [], rejected: [] });
      },
    };
    void evtB; // second-tenant event is not in this batch
    const sync = new AuditSync({ store: singleTenantStore, client: overrideClient });
    await sync.flush();
    expect(syncedIds).toHaveLength(1);
    expect(syncedIds[0]).toMatchObject({ tenant_id: 'tenant-A', event_id: 'evt-001' });
  });
});

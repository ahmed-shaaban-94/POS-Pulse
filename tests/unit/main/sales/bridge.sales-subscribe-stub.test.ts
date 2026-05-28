/**
 * T072 — `sales.subscribe` + `sales.unsubscribe` bridge handler test (RED).
 *
 * Per tasks.md T072 + contracts/bridge-api.md §"sales.subscribe":
 *
 * The push-subscription primitive (webContents.send + token registry) is
 * not yet implemented in the codebase — 005's `cart.subscribe` is a stub
 * returning `refuse('not_implemented')`. 008's `sales.subscribe` mirrors
 * that posture for S1c.2 (per user decision in brainstorm). A future
 * task implements the primitive properly. Until then:
 *   - `sales.subscribe` returns `{ kind: 'refused', reason: 'not_implemented' }`.
 *   - `sales.unsubscribe` is intentionally a no-op returning `{ kind: 'ok' }`
 *     (the shared `SalesUnsubscribeResponse` type has no refusal branch;
 *     since no registry exists, unsubscribing any token is trivially safe).
 *
 * The contract-side topics (`'recent'` and `'banner_state'`) are
 * accepted at the type level but the runtime behaviour is the same
 * `not_implemented` refusal for both.
 */

import { describe, expect, it } from 'vitest';

import { createSalesBridge } from '../../../../src/main/sales/sales-bridge.js';

const SESSION = {
  role: 'cashier' as const,
  operator_id: 'op-clerk-user-abc',
  operator_session_id: 'sess-1',
  tenant_id: 'tenant-1',
  branch_id: 'branch-1',
  terminal_id: 'terminal-1',
};

// Stub repos for the subscribe-stub tests — subscribe doesn't touch the DB.
const STUB_SALES_REPO = {
  insert: () => {},
  readById: () => null,
  findByNumber: () => null,
  findByHandoffActionId: () => null,
};
const STUB_PRINT_REPO = {
  insert: () => {},
  readBySale: () => [],
  hasSuccessfulPrint: () => false,
  countReprints: () => 0,
};
const STUB_DRAWER_REPO = {
  insert: () => {},
  readBySale: () => null,
  findLastSuccessfulOpenForTerminal: () => null,
};

describe('T072 — sales.subscribe: stub matching 005 cart.subscribe', () => {
  it('subscribe(topic="recent") returns not_implemented (stub)', async () => {
    const bridge = createSalesBridge({
      getCurrentSession: () => SESSION,
      salesRepo: STUB_SALES_REPO,
      printEventsRepo: STUB_PRINT_REPO,
      drawerEventsRepo: STUB_DRAWER_REPO,
    });
    const result = await bridge.subscribe({ topic: 'recent' });
    expect(result.kind).toBe('refused');
    if (result.kind !== 'refused') return;
    expect(result.reason).toBe('not_implemented');
  });

  it('subscribe(topic="banner_state") returns not_implemented (stub)', async () => {
    const bridge = createSalesBridge({
      getCurrentSession: () => SESSION,
      salesRepo: STUB_SALES_REPO,
      printEventsRepo: STUB_PRINT_REPO,
      drawerEventsRepo: STUB_DRAWER_REPO,
    });
    const result = await bridge.subscribe({ topic: 'banner_state' });
    expect(result.kind).toBe('refused');
    if (result.kind !== 'refused') return;
    expect(result.reason).toBe('not_implemented');
  });

  it('subscribe still gates on session (no_session refusal precedes not_implemented)', async () => {
    const bridge = createSalesBridge({
      getCurrentSession: () => null,
      salesRepo: STUB_SALES_REPO,
      printEventsRepo: STUB_PRINT_REPO,
      drawerEventsRepo: STUB_DRAWER_REPO,
    });
    const result = await bridge.subscribe({ topic: 'recent' });
    expect(result.kind).toBe('refused');
    if (result.kind !== 'refused') return;
    expect(result.reason).toBe('no_session');
  });

  it('unsubscribe returns ok as a no-op (no subscription registry yet)', async () => {
    // Per shared SalesUnsubscribeResponse type — only { kind: 'ok' }, no
    // refusal branch. With subscribe returning not_implemented, the
    // registry never holds tokens, so unsubscribe is a trivial no-op.
    const bridge = createSalesBridge({
      getCurrentSession: () => SESSION,
      salesRepo: STUB_SALES_REPO,
      printEventsRepo: STUB_PRINT_REPO,
      drawerEventsRepo: STUB_DRAWER_REPO,
    });
    const result = await bridge.unsubscribe({ subscription_token: 'tok-1' });
    expect(result.kind).toBe('ok');
  });
});

describe('T072 — sales.subscribe + unsubscribe: forbidden-field guard (CR3 on PR #266)', () => {
  it('subscribe refuses with forbidden_field_in_request when payload contains a forbidden key', async () => {
    const bridge = createSalesBridge({
      getCurrentSession: () => SESSION,
      salesRepo: STUB_SALES_REPO,
      printEventsRepo: STUB_PRINT_REPO,
      drawerEventsRepo: STUB_DRAWER_REPO,
    });
    const result = await bridge.subscribe({
      topic: 'recent',
      pan: 'TEST_PAN_TOKEN_NOT_A_REAL_CARD',
    } as unknown as { topic: 'recent' });
    expect(result.kind).toBe('refused');
    if (result.kind !== 'refused') return;
    expect(result.reason).toBe('forbidden_field_in_request');
  });

  it('unsubscribe throws when payload contains a forbidden key (SalesUnsubscribeResponse has no refusal branch)', async () => {
    const bridge = createSalesBridge({
      getCurrentSession: () => SESSION,
      salesRepo: STUB_SALES_REPO,
      printEventsRepo: STUB_PRINT_REPO,
      drawerEventsRepo: STUB_DRAWER_REPO,
    });
    await expect(
      bridge.unsubscribe({
        subscription_token: 'tok-1',
        voucher_redemption_intent_token: 'TOKEN',
      } as unknown as { subscription_token: string }),
    ).rejects.toThrow(/forbidden field in request/);
  });
});

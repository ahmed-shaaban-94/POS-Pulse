/**
 * `sales.subscribe` + `sales.unsubscribe` bridge handler test.
 *
 * Snapshot-subscribe (008 follow-up slice — coordination §S3c mechanism note):
 * subscribe returns the current projection for the topic via the injected
 * `bannerStateProjector`; the renderer polls it (no push channel). When the
 * projector is NOT wired (legacy S1 construction), subscribe falls back to the
 * `not_implemented` refusal. Session gating + forbidden-field guard precede
 * either path; unsubscribe is a no-op.
 */

import { describe, expect, it, vi } from 'vitest';

import { createSalesBridge } from '../../../../src/main/sales/sales-bridge.js';
import type { BannerStateProjector } from '../../../../src/main/sales/banner-state-projector.js';
import type { BannerState, RecentSaleSummary } from '../../../../src/shared/sales/types.js';

const SESSION = {
  role: 'cashier' as const,
  operator_id: 'op-clerk-user-abc',
  operator_session_id: 'sess-1',
  tenant_id: 'tenant-1',
  branch_id: 'branch-1',
  terminal_id: 'terminal-1',
};

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

function projectorStub(over: Partial<BannerStateProjector> = {}): BannerStateProjector {
  return {
    projectBannerState: vi.fn((): BannerState => ({ kind: 'none' })),
    projectRecentSale: vi.fn((): RecentSaleSummary | null => null),
    ...over,
  };
}

function bridgeWith(opts: { session?: typeof SESSION | null; projector?: BannerStateProjector }) {
  return createSalesBridge({
    getCurrentSession: () => opts.session ?? null,
    salesRepo: STUB_SALES_REPO,
    printEventsRepo: STUB_PRINT_REPO,
    drawerEventsRepo: STUB_DRAWER_REPO,
    bannerStateProjector: opts.projector,
    newSubscriptionToken: () => 'tok-1',
  });
}

describe('sales.subscribe — snapshot projection (projector wired)', () => {
  it('subscribe(topic="banner_state") returns the projected BannerState', async () => {
    const bannerState: BannerState = {
      kind: 'printer_failure',
      sale_id: 'sale-1',
      failure_reason: 'printer_offline',
      has_successful_print: false,
    };
    const projector = projectorStub({ projectBannerState: vi.fn(() => bannerState) });
    const result = await bridgeWith({ session: SESSION, projector }).subscribe({
      topic: 'banner_state',
    });
    expect(result.kind).toBe('ok');
    if (result.kind === 'ok' && 'banner_state' in result) {
      expect(result.banner_state).toEqual(bannerState);
      expect(result.subscription_token).toBe('tok-1');
    } else {
      throw new Error('expected ok banner_state response');
    }
  });

  it('subscribe(topic="recent") returns the projected recent-sale summary', async () => {
    const recent: RecentSaleSummary = {
      sale_id: 'sale-9',
      sale_number: 'TERM-01-2026-05-27-000009',
      finalized_at: '2026-05-27T10:05:00.000Z',
    };
    const projector = projectorStub({ projectRecentSale: vi.fn(() => recent) });
    const result = await bridgeWith({ session: SESSION, projector }).subscribe({ topic: 'recent' });
    expect(result.kind).toBe('ok');
    if (result.kind === 'ok' && 'recent' in result) {
      expect(result.recent).toEqual(recent);
    } else {
      throw new Error('expected ok recent response');
    }
  });
});

describe('sales.subscribe — gating + fallback', () => {
  it('gates on session (no_session precedes any projection)', async () => {
    const result = await bridgeWith({ session: null, projector: projectorStub() }).subscribe({
      topic: 'recent',
    });
    expect(result.kind).toBe('refused');
    if (result.kind === 'refused') expect(result.reason).toBe('no_session');
  });

  it('falls back to not_implemented when no projector is wired (legacy S1 construction)', async () => {
    const bridge = createSalesBridge({
      getCurrentSession: () => SESSION,
      salesRepo: STUB_SALES_REPO,
      printEventsRepo: STUB_PRINT_REPO,
      drawerEventsRepo: STUB_DRAWER_REPO,
    });
    const result = await bridge.subscribe({ topic: 'banner_state' });
    expect(result.kind).toBe('refused');
    if (result.kind === 'refused') expect(result.reason).toBe('not_implemented');
  });

  it('refuses forbidden_field_in_request before projecting', async () => {
    const result = await bridgeWith({ session: SESSION, projector: projectorStub() }).subscribe({
      topic: 'recent',
      pan: 'TEST_PAN_TOKEN_NOT_A_REAL_CARD',
    } as unknown as { topic: 'recent' });
    expect(result.kind).toBe('refused');
    if (result.kind === 'refused') expect(result.reason).toBe('forbidden_field_in_request');
  });

  it('mints a non-empty subscription_token via the default generator when none injected', async () => {
    const bridge = createSalesBridge({
      getCurrentSession: () => SESSION,
      salesRepo: STUB_SALES_REPO,
      printEventsRepo: STUB_PRINT_REPO,
      drawerEventsRepo: STUB_DRAWER_REPO,
      bannerStateProjector: projectorStub(),
      // newSubscriptionToken omitted → exercises the per-bridge fallback.
    });
    const result = await bridge.subscribe({ topic: 'recent' });
    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') {
      expect(result.subscription_token).toMatch(/^sub-\d+$/);
    }
  });

  it('unsubscribe returns ok as a no-op (no registry in snapshot mode)', async () => {
    const result = await bridgeWith({ session: SESSION, projector: projectorStub() }).unsubscribe({
      subscription_token: 'tok-1',
    });
    expect(result.kind).toBe('ok');
  });

  it('unsubscribe throws on a forbidden key (SalesUnsubscribeResponse has no refusal branch)', async () => {
    await expect(
      bridgeWith({ session: SESSION, projector: projectorStub() }).unsubscribe({
        subscription_token: 'tok-1',
        voucher_redemption_intent_token: 'TOKEN',
      } as unknown as { subscription_token: string }),
    ).rejects.toThrow(/forbidden field in request/);
  });
});

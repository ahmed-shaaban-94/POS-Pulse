import { describe, expect, it } from 'vitest';

import type { OperatorSessionForCatalogue } from '../require-catalogue-session.js';
import { createCatalogueBridge } from '../catalogue-bridge.js';
import type { CatalogueSyncStateRow } from '../catalogue-sync-state-repo.js';

/**
 * 010 diagnostics — `catalogue:counts` bridge contract (read-only diagnostics).
 *
 * A tenant-scoped, secret-free read of the LOCAL read model size for the
 * Catalogue Diagnostics screen: { products, barcodes } integer counts. Mirrors
 * the `freshness` controls:
 *   • AD-1: session gate is the FIRST step (refusal short-circuits before any read).
 *   • AD-2: generic refusal — `{ kind:'refused', reason:'no_session' }`.
 *   • P17-1: tenant-scoped — counts are read for the session tenant ONLY.
 *   • No catalogue data / no secrets — integers only (WR-2).
 *   • No counts source wired → refuse (cannot read truthfully), never throw/leak.
 */

const SESSION: OperatorSessionForCatalogue = {
  role: 'cashier',
  operator_id: 'op-1',
  operator_session_id: 'sess-1',
  tenant_id: 'tenant-A',
  branch_id: 'branch-1',
};

const ROW: CatalogueSyncStateRow = {
  tenant_id: 'tenant-A',
  branch_id: 'branch-1',
  last_success_at: '2026-06-16T12:37:42.035Z',
  source_snapshot_id: 'snap-1',
  last_attempt_at: null,
  last_outcome: 'succeeded',
};

/** A fake counts source: tenant-scoped product + barcode counts. */
function fakeCounts(tenantId: string, products: number, barcodes: number) {
  return {
    readSyncState: (t: string) => (t === tenantId ? ROW : null),
    countProducts: (t: string) => (t === tenantId ? products : 0),
    countBarcodes: (t: string) => (t === tenantId ? barcodes : 0),
  };
}

describe('catalogue:counts bridge contract (diagnostics)', () => {
  it('refuses no_session before reading counts (AD-1/AD-2)', async () => {
    const bridge = createCatalogueBridge({
      getCurrentSession: () => null,
      freshness: fakeCounts('tenant-A', 50, 49),
    });

    const res = await bridge.counts({});

    expect(res).toEqual({ kind: 'refused', reason: 'no_session' });
  });

  it('refuses when no counts source is wired (cannot read truthfully)', async () => {
    const bridge = createCatalogueBridge({
      getCurrentSession: () => SESSION,
      // no freshness/counts source
    });

    const res = await bridge.counts({});

    expect(res.kind).toBe('refused');
  });

  it('returns tenant-scoped { products, barcodes } integers when a session + source exist', async () => {
    const bridge = createCatalogueBridge({
      getCurrentSession: () => SESSION,
      freshness: fakeCounts('tenant-A', 50, 49),
    });

    const res = await bridge.counts({});

    expect(res).toEqual({ kind: 'ok', products: 50, barcodes: 49 });
  });

  it('scopes counts to the session tenant (a different tenant reads 0)', async () => {
    const bridge = createCatalogueBridge({
      getCurrentSession: () => SESSION,
      // source only knows tenant-B → session tenant-A reads 0/0
      freshness: fakeCounts('tenant-B', 50, 49),
    });

    const res = await bridge.counts({});

    expect(res).toEqual({ kind: 'ok', products: 0, barcodes: 0 });
  });
});

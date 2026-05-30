import { describe, expect, it } from 'vitest';

import {
  requireCatalogueSession,
  type OperatorSessionForCatalogue,
} from '../require-catalogue-session.js';
import { createCatalogueBridge } from '../catalogue-bridge.js';

/**
 * 009-product-search-and-barcode-lookup T014 — `catalogue.*` bridge gating.
 *
 * The `catalogue.*` namespace is the renderer↔main trust boundary for product
 * lookup (Constitution III; AD-1). Every handler's first executable step is the
 * session gate (NFR-6a): no active session → generic `no_session` refusal; a
 * query/result that crosses tenant → generic `tenant_isolation` refusal. The
 * reason is for diagnostics only — never echoed to the cashier verbatim.
 *
 * S1 ships the SKELETON: with a valid session every handler returns the honest
 * `catalogue_unavailable` stub (the read model is not wired until S2), so this
 * suite asserts (a) the gate mechanism and (b) that each handler is gated
 * before it does anything else. Tenant-isolation against real product rows is
 * exercised at S2 (T022/T026) when the repo query is tenant-scoped; here it is
 * proven at the gate unit.
 */

const SESSION: OperatorSessionForCatalogue = {
  role: 'cashier',
  operator_id: 'op-1',
  operator_session_id: 'sess-1',
  tenant_id: 'tenant-A',
  branch_id: 'branch-1',
};

describe('requireCatalogueSession (gate unit)', () => {
  it('refuses no_session when there is no active session', () => {
    const result = requireCatalogueSession(null);
    expect(result).toEqual({ kind: 'refused', reason: 'no_session' });
  });

  it('passes when a session is present and no resource tenant is supplied', () => {
    const result = requireCatalogueSession(SESSION);
    expect(result).toEqual({ kind: 'ok', session: SESSION });
  });

  it('passes when the resource tenant matches the session tenant', () => {
    const result = requireCatalogueSession(SESSION, 'tenant-A');
    expect(result).toEqual({ kind: 'ok', session: SESSION });
  });

  it('refuses tenant_isolation when the resource tenant differs (generic)', () => {
    const result = requireCatalogueSession(SESSION, 'tenant-B');
    expect(result).toEqual({ kind: 'refused', reason: 'tenant_isolation' });
  });
});

describe('createCatalogueBridge — every handler is session-gated first (NFR-6a)', () => {
  const noSession = createCatalogueBridge({ getCurrentSession: () => null });

  it('lookupBarcode refuses no_session without an active session', async () => {
    await expect(noSession.lookupBarcode({ barcode: '6221000000001' })).resolves.toEqual({
      kind: 'refused',
      reason: 'no_session',
    });
  });

  it('lookupSku refuses no_session without an active session', async () => {
    await expect(noSession.lookupSku({ sku: 'SKU-PARA-500' })).resolves.toEqual({
      kind: 'refused',
      reason: 'no_session',
    });
  });

  it('search refuses no_session without an active session', async () => {
    await expect(noSession.search({ query: 'بنادول' })).resolves.toEqual({
      kind: 'refused',
      reason: 'no_session',
    });
  });

  it('resolve refuses no_session without an active session', async () => {
    await expect(noSession.resolve({ product_id: 'p-1' })).resolves.toEqual({
      kind: 'refused',
      reason: 'no_session',
    });
  });
});

describe('createCatalogueBridge — a valid session passes the gate (S1 stub)', () => {
  const withSession = createCatalogueBridge({ getCurrentSession: () => SESSION });

  it('lookupBarcode returns the catalogue_unavailable stub (not a no_session refusal)', async () => {
    await expect(withSession.lookupBarcode({ barcode: '6221000000001' })).resolves.toEqual({
      kind: 'catalogue_unavailable',
    });
  });

  it('lookupSku returns the catalogue_unavailable stub', async () => {
    await expect(withSession.lookupSku({ sku: 'SKU-PARA-500' })).resolves.toEqual({
      kind: 'catalogue_unavailable',
    });
  });

  it('search returns the catalogue_unavailable stub', async () => {
    await expect(withSession.search({ query: 'بنادول' })).resolves.toEqual({
      kind: 'catalogue_unavailable',
    });
  });

  it('resolve returns the catalogue_unavailable stub', async () => {
    await expect(withSession.resolve({ product_id: 'p-1' })).resolves.toEqual({
      kind: 'catalogue_unavailable',
    });
  });
});

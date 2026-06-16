import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';

import { CatalogueDiagnostics } from '../CatalogueDiagnostics';
import type {
  CatalogueCountsResponse,
  CatalogueFreshnessResponse,
  CatalogueRefreshResponse,
  CatalogueSearchResponse,
} from '../../../../shared/bridge-api.js';
import type { PairingStatus } from '../../../../shared/pairing-types';

/**
 * 010 diagnostics — read-only Catalogue Diagnostics screen.
 *
 * Composes existing read-only bridge calls into one operator-visible panel:
 *   • pairing.getStatus() → tenant/store/terminal identifiers (NEVER the token).
 *   • catalogue.counts()  → products + barcode-alias counts.
 *   • catalogue.freshness()/refresh() → sync state + manual refresh.
 *   • catalogue.search()  → read-only local search.
 * Bridges are injected (the established `_testBridge` seam); production reads
 * window.api.
 */

const PAIRED: Extract<PairingStatus, { kind: 'paired' }> = {
  kind: 'paired',
  tenant_id: 'tenant-A',
  branch_id: 'store-1',
  terminal_id: 'term-9',
  terminal_label: 'Pilot Counter 1',
} as Extract<PairingStatus, { kind: 'paired' }>;

function bridge(over: {
  status?: () => Promise<PairingStatus>;
  counts?: () => Promise<CatalogueCountsResponse>;
  freshness?: () => Promise<CatalogueFreshnessResponse>;
  refresh?: () => Promise<CatalogueRefreshResponse>;
  search?: () => Promise<CatalogueSearchResponse>;
}) {
  // Flat method handles — mirrors the DiagnosticsBridge seam (no nested namespaces).
  return {
    getStatus: over.status ?? (() => Promise.resolve(PAIRED)),
    counts:
      over.counts ?? (() => Promise.resolve({ kind: 'ok' as const, products: 50, barcodes: 49 })),
    freshness:
      over.freshness ??
      (() =>
        Promise.resolve({
          kind: 'ok' as const,
          last_success_at: '2026-06-16T12:37:42.035Z',
          is_empty: false,
        })),
    refresh: over.refresh ?? (() => Promise.resolve({ kind: 'started' as const })),
    search: over.search ?? (() => Promise.resolve({ kind: 'not_found' as const })),
  };
}

function renderScreen(b: ReturnType<typeof bridge>) {
  return render(
    <MemoryRouter>
      <CatalogueDiagnostics bridge={b} />
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
});

describe('CatalogueDiagnostics', () => {
  it('shows the paired tenant/store/terminal identifiers', async () => {
    renderScreen(bridge({}));
    await waitFor(() => expect(screen.getByTestId('diagnostics-pairing')).toBeInTheDocument());
    const panel = screen.getByTestId('diagnostics-pairing');
    expect(panel).toHaveTextContent('tenant-A');
    expect(panel).toHaveTextContent('store-1');
    expect(panel).toHaveTextContent('term-9');
  });

  it('shows the product and barcode counts from catalogue.counts', async () => {
    renderScreen(bridge({}));
    await waitFor(() => expect(screen.getByTestId('diagnostics-counts')).toHaveTextContent('50'));
    expect(screen.getByTestId('diagnostics-counts')).toHaveTextContent('49');
  });

  it('NEVER renders a device token (no secret in text or DOM attributes)', async () => {
    const { container } = renderScreen(
      bridge({
        // even if a malicious status carried a token field, the screen must not surface it
        status: () =>
          Promise.resolve({ ...PAIRED, device_token: 'tok_SECRET_should_never_render' } as never),
      }),
    );
    await waitFor(() => expect(screen.getByTestId('diagnostics-pairing')).toBeInTheDocument());
    expect(container.innerHTML).not.toContain('tok_SECRET_should_never_render');
    expect(container.innerHTML).not.toContain('device_token');
  });

  it('renders a read-only search box and a manual refresh control', async () => {
    renderScreen(bridge({}));
    await waitFor(() => expect(screen.getByTestId('diagnostics-search')).toBeInTheDocument());
    expect(screen.getByTestId('diagnostics-refresh')).toBeInTheDocument();
  });

  it('calls catalogue.refresh when the refresh control is clicked (honest status)', async () => {
    const refresh = vi.fn(() => Promise.resolve({ kind: 'started' as const }));
    renderScreen(bridge({ refresh }));
    const btn = await screen.findByTestId('diagnostics-refresh');
    await userEvent.click(btn);
    await waitFor(() => {
      expect(refresh).toHaveBeenCalled();
    });
    // honest status surfaces (started), never a fake "done"
    await waitFor(() =>
      expect(screen.getByTestId('diagnostics-refresh-status')).toHaveTextContent('started'),
    );
  });

  it('renders "unavailable" counts when catalogue.counts is refused', async () => {
    renderScreen(
      bridge({ counts: () => Promise.resolve({ kind: 'refused', reason: 'no_session' }) }),
    );
    await waitFor(() =>
      expect(screen.getByTestId('diagnostics-counts')).toHaveTextContent('unavailable'),
    );
  });

  it('shows "Not paired." when pairing status is not paired', async () => {
    renderScreen(bridge({ status: () => Promise.resolve({ kind: 'unpaired' } as never) }));
    await waitFor(() =>
      expect(screen.getByTestId('diagnostics-pairing')).toHaveTextContent('Not paired'),
    );
  });

  it('freshness: never-synced (null) shows "never synced"', async () => {
    renderScreen(
      bridge({
        freshness: () => Promise.resolve({ kind: 'ok', last_success_at: null, is_empty: true }),
      }),
    );
    await waitFor(() =>
      expect(screen.getByTestId('diagnostics-sync-state')).toHaveTextContent('never synced'),
    );
  });

  it('freshness: synced-but-empty shows the empty marker', async () => {
    renderScreen(
      bridge({
        freshness: () =>
          Promise.resolve({
            kind: 'ok',
            last_success_at: '2026-06-16T12:00:00.000Z',
            is_empty: true,
          }),
      }),
    );
    await waitFor(() =>
      expect(screen.getByTestId('diagnostics-sync-state')).toHaveTextContent('empty'),
    );
  });

  it('freshness: refused shows "unavailable"', async () => {
    renderScreen(
      bridge({ freshness: () => Promise.resolve({ kind: 'refused', reason: 'no_session' }) }),
    );
    await waitFor(() =>
      expect(screen.getByTestId('diagnostics-sync-state')).toHaveTextContent('unavailable'),
    );
  });

  it('search: a >=2-char query calls catalogue.search and renders the match count', async () => {
    const search = vi.fn(() =>
      Promise.resolve({
        kind: 'results' as const,
        items: [{ product_id: 'p-1' }] as never,
        truncated: false,
      }),
    );
    renderScreen(bridge({ search }));
    const input = await screen.findByLabelText('Search local catalogue');
    await userEvent.type(input, 'para');
    await waitFor(() => expect(search).toHaveBeenCalledWith({ query: 'para' }));
    await waitFor(() =>
      expect(screen.getByTestId('diagnostics-search-results')).toHaveTextContent('1 match'),
    );
  });

  it('search: a sub-2-char query never calls the bridge (short-circuit)', async () => {
    const search = vi.fn(() => Promise.resolve({ kind: 'not_found' as const }));
    renderScreen(bridge({ search }));
    const input = await screen.findByLabelText('Search local catalogue');
    await userEvent.type(input, 'p');
    // give any pending effect a tick; the bridge must NOT have been called
    await waitFor(() => expect(input).toHaveValue('p'));
    expect(search).not.toHaveBeenCalled();
  });

  it('search: a rejected bridge call surfaces "unavailable" (never throws)', async () => {
    const search = vi.fn(() => Promise.reject(new Error('boom')));
    renderScreen(bridge({ search }));
    const input = await screen.findByLabelText('Search local catalogue');
    await userEvent.type(input, 'para');
    await waitFor(() =>
      expect(screen.getByTestId('diagnostics-search-results')).toHaveTextContent('unavailable'),
    );
  });
});

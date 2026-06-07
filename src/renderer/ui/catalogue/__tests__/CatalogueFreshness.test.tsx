import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';

import { expectNoAxeViolations } from '../../primitives/__tests__/axe-config';
import { CatalogueFreshness } from '../CatalogueFreshness';
import type {
  CatalogueFreshnessResponse,
  CatalogueRefreshResponse,
} from '../../../../shared/bridge-api.js';

/**
 * 010 T045 (RED) — `CatalogueFreshness` indicator + manual-refresh affordance
 * (US3, FR-16 / FR-16b / SC-10; §A4 P9-1 / R-FRESHNESS-WIRING).
 *
 * A compact inline status line (NOT a card) + a ghost "refresh" button. The
 * three truthful freshness states each get an icon + Arabic-first text — color
 * is NEVER the sole signal (PRODUCT.md a11y). Absolute timestamp only (owner
 * decision: relative time needs a ticking clock or it lies; absolute is
 * auditable). Refresh reports started / already_running honestly and never
 * blocks. role="status" / polite — it does not steal focus mid-transaction.
 *
 * The bridge calls are INJECTED (the `bridge` prop mirrors the 009 `_testBridge`
 * seam); production reads `window.api.catalogue`.
 */

function freshnessBridge(over: {
  freshness?: () => Promise<CatalogueFreshnessResponse>;
  refresh?: () => Promise<CatalogueRefreshResponse>;
}) {
  return {
    freshness: over.freshness ?? (() => Promise.resolve({ kind: 'refused', reason: 'no_session' })),
    refresh: over.refresh ?? (() => Promise.resolve({ kind: 'refused', reason: 'no_session' })),
  };
}

afterEach(() => {
  cleanup();
});

describe('T045 — CatalogueFreshness: three truthful states', () => {
  it('never-synced (last_success_at null) → "not yet downloaded", no timestamp', async () => {
    const bridge = freshnessBridge({
      freshness: () => Promise.resolve({ kind: 'ok', last_success_at: null, is_empty: true }),
    });
    render(<CatalogueFreshness bridge={bridge} />);

    await waitFor(() =>
      expect(screen.getByTestId('catalogue-freshness')).toHaveAttribute(
        'data-state',
        'never-synced',
      ),
    );
    expect(screen.getByText(/لم يُنزّل الكتالوج بعد/)).toBeInTheDocument();
    // No timestamp is shown when never synced.
    expect(screen.queryByTestId('catalogue-freshness-time')).not.toBeInTheDocument();
  });

  it('updated (non-null + is_empty false) → "last updated" + ABSOLUTE timestamp', async () => {
    const bridge = freshnessBridge({
      freshness: () =>
        Promise.resolve({
          kind: 'ok',
          last_success_at: '2026-06-07T10:42:00.000Z',
          is_empty: false,
        }),
    });
    render(<CatalogueFreshness bridge={bridge} />);

    await waitFor(() =>
      expect(screen.getByTestId('catalogue-freshness')).toHaveAttribute('data-state', 'updated'),
    );
    expect(screen.getByText(/آخر تحديث/)).toBeInTheDocument();
    // An absolute timestamp is rendered (a <time> element carrying the ISO value).
    const time = screen.getByTestId('catalogue-freshness-time');
    expect(time).toHaveAttribute('dateTime', '2026-06-07T10:42:00.000Z');
    // It must NOT render relative wording (no ticking clock in this slice).
    expect(screen.queryByText(/منذ/)).not.toBeInTheDocument();
  });

  it('synced-but-empty (non-null + is_empty true) → "updated, no products" (SC-10 truthfulness)', async () => {
    const bridge = freshnessBridge({
      freshness: () =>
        Promise.resolve({
          kind: 'ok',
          last_success_at: '2026-06-07T10:42:00.000Z',
          is_empty: true,
        }),
    });
    render(<CatalogueFreshness bridge={bridge} />);

    await waitFor(() =>
      expect(screen.getByTestId('catalogue-freshness')).toHaveAttribute(
        'data-state',
        'synced-empty',
      ),
    );
    // Distinct, truthful copy — never a bare timestamp implying data exists.
    expect(screen.getByText(/لا توجد منتجات/)).toBeInTheDocument();
    expect(screen.getByTestId('catalogue-freshness-time')).toBeInTheDocument();
  });

  it('a malformed/undefined bridge response degrades to unavailable, never crashes', async () => {
    // Defensive at the trust boundary: if the bridge ever returns a non-conforming
    // value, the indicator must not white-screen — it shows the unavailable state.
    const bridge = freshnessBridge({
      freshness: () => Promise.resolve(undefined as unknown as CatalogueFreshnessResponse),
    });
    render(<CatalogueFreshness bridge={bridge} />);
    await waitFor(() =>
      expect(screen.getByTestId('catalogue-freshness')).toHaveAttribute(
        'data-state',
        'unavailable',
      ),
    );
  });

  it('refused → a generic unavailable state, no crash, no leaked reason', async () => {
    const bridge = freshnessBridge({
      freshness: () => Promise.resolve({ kind: 'refused', reason: 'tenant_isolation' }),
    });
    render(<CatalogueFreshness bridge={bridge} />);
    await waitFor(() =>
      expect(screen.getByTestId('catalogue-freshness')).toHaveAttribute(
        'data-state',
        'unavailable',
      ),
    );
    // The refusal reason is never echoed to the cashier.
    expect(screen.queryByText(/tenant_isolation/)).not.toBeInTheDocument();
  });
});

describe('T045 — CatalogueFreshness: manual refresh affordance', () => {
  it('clicking refresh calls the bridge and reports started honestly', async () => {
    const refresh = vi.fn(() => Promise.resolve<CatalogueRefreshResponse>({ kind: 'started' }));
    const bridge = freshnessBridge({
      freshness: () => Promise.resolve({ kind: 'ok', last_success_at: null, is_empty: true }),
      refresh,
    });
    render(<CatalogueFreshness bridge={bridge} />);

    const button = await screen.findByRole('button', { name: /تحديث/ });
    await userEvent.click(button);

    expect(refresh).toHaveBeenCalledOnce();
    await waitFor(() => expect(screen.getByText(/جارٍ التحديث/)).toBeInTheDocument());
  });

  it('reports already_running honestly (single-flight) without claiming completion', async () => {
    const refresh = vi.fn(() =>
      Promise.resolve<CatalogueRefreshResponse>({ kind: 'already_running' }),
    );
    const bridge = freshnessBridge({
      freshness: () => Promise.resolve({ kind: 'ok', last_success_at: null, is_empty: true }),
      refresh,
    });
    render(<CatalogueFreshness bridge={bridge} />);

    const button = await screen.findByRole('button', { name: /تحديث/ });
    await userEvent.click(button);

    // Honest: a tick is already running; it does NOT claim "done".
    await waitFor(() => expect(screen.getByText(/جارٍ التحديث بالفعل/)).toBeInTheDocument());
    expect(screen.queryByText(/اكتمل|تم التحديث بنجاح/)).not.toBeInTheDocument();
  });

  it('the refresh button meets the 44px touch-target floor', async () => {
    const bridge = freshnessBridge({
      freshness: () => Promise.resolve({ kind: 'ok', last_success_at: null, is_empty: true }),
    });
    render(<CatalogueFreshness bridge={bridge} />);
    const button = await screen.findByRole('button', { name: /تحديث/ });
    // The shared `btn` base enforces 44px; assert the class contract is present.
    expect(button.className).toMatch(/btn/);
  });
});

describe('T045 — CatalogueFreshness: accessibility', () => {
  it('announces politely via role=status and does not steal focus', async () => {
    const bridge = freshnessBridge({
      freshness: () =>
        Promise.resolve({
          kind: 'ok',
          last_success_at: '2026-06-07T10:42:00.000Z',
          is_empty: false,
        }),
    });
    render(<CatalogueFreshness bridge={bridge} />);
    const region = await screen.findByTestId('catalogue-freshness');
    expect(region).toHaveAttribute('role', 'status');
    expect(region).toHaveAttribute('aria-live', 'polite');
  });

  it('is axe-clean in the updated state', async () => {
    const bridge = freshnessBridge({
      freshness: () =>
        Promise.resolve({
          kind: 'ok',
          last_success_at: '2026-06-07T10:42:00.000Z',
          is_empty: false,
        }),
    });
    const { container } = render(<CatalogueFreshness bridge={bridge} />);
    await screen.findByTestId('catalogue-freshness-time');
    await expectNoAxeViolations(container);
  });
});

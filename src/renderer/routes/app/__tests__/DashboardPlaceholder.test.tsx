import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';

import { DashboardPlaceholder } from '../DashboardPlaceholder';

afterEach(cleanup);
afterEach(() => vi.unstubAllGlobals());

/**
 * T033 — DashboardPlaceholder: default-state render; no fetch/IPC/persistence.
 */
describe('DashboardPlaceholder (T033)', () => {
  it('renders default content', () => {
    render(
      <MemoryRouter>
        <DashboardPlaceholder />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: /dashboard/i })).toBeInTheDocument();
  });

  it('zero fetch calls on mount', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    render(
      <MemoryRouter>
        <DashboardPlaceholder />
      </MemoryRouter>,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('zero localStorage calls on mount', () => {
    const spy = vi.spyOn(window, 'localStorage', 'get');
    render(
      <MemoryRouter>
        <DashboardPlaceholder />
      </MemoryRouter>,
    );
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

/**
 * POS v3.5 Slice 5 — dev/production gating of the demo dashboard.
 *
 * The rich demo dashboard is DEV-ONLY. The pilot/production build must NEVER
 * render fabricated metrics — it renders the honest, value-free DashboardSkeleton
 * (owner directive, Phase 4: "do NOT fabricate any metric"). The demo path is
 * owner-approved (2026-06-22) strictly for dev preview behind a DEMO banner.
 *
 * NOTE: a DEV-false unit test proves the BRANCH LOGIC. It does NOT prove the
 * sample-data module is tree-shaken out of the shipped bundle — that is verified
 * separately by an empirical bundle grep in the PR (sample data is imported
 * inside the DEV branch, never at module top level).
 */
describe('DashboardPlaceholder — demo is dev + opt-in only (default renders honest skeleton)', () => {
  const realSearch = window.location.search;
  afterEach(() => {
    window.history.replaceState({}, '', `${window.location.pathname}${realSearch}`);
  });

  function renderDash(dev: boolean, query = '') {
    window.history.replaceState({}, '', `/${query}`);
    return render(
      <MemoryRouter>
        <DashboardPlaceholder devOverride={dev} />
      </MemoryRouter>,
    );
  }

  it('DEV + ?demo=1: shows an un-missable DEMO banner (lazy-loaded)', async () => {
    renderDash(true, '?demo=1');
    // DashboardDemo is React.lazy → resolve the Suspense boundary first.
    const banner = await screen.findByTestId('dashboard-demo-banner');
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveTextContent(/demo/i);
  });

  it('DEV without ?demo: renders the honest skeleton (demo is never the default)', () => {
    renderDash(true, '');
    expect(screen.queryByTestId('dashboard-demo-banner')).not.toBeInTheDocument();
    expect(screen.getByTestId('dashboard-skeleton')).toBeInTheDocument();
  });

  it('PRODUCTION build (even with ?demo=1): renders the honest skeleton, NO banner', () => {
    renderDash(false, '?demo=1');
    expect(screen.queryByTestId('dashboard-demo-banner')).not.toBeInTheDocument();
    expect(screen.getByTestId('dashboard-skeleton')).toBeInTheDocument();
  });

  it('PRODUCTION build: renders ZERO digits anywhere (no fabricated figures ship)', () => {
    const { container } = renderDash(false, '?demo=1');
    // The whole production render must contain no numeric character — any digit
    // would be a fabricated metric reaching a pilot build.
    expect(container.textContent).not.toMatch(/\d/);
  });
});

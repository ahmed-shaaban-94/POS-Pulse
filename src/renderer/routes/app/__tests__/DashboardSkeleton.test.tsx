/**
 * POS v3.5 Phase 4 — <DashboardSkeleton>.
 *
 * The v3.5 dashboard layout as a VISUAL skeleton. There is NO functional data
 * here: today's sales count/total, top items, and shift-at-a-glance all have
 * no renderer-facing source yet, so each is an honest "coming soon" placeholder
 * — never a fabricated number. The skeleton performs no fetch and no storage
 * access (mirroring the existing DashboardPlaceholder contract).
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import { DashboardSkeleton } from '../DashboardSkeleton';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('DashboardSkeleton — honest placeholders (no fabricated data)', () => {
  const placeholders = [
    ['shift', /shift/i],
    ['sales-today', /today/i],
    ['top-items', /top items/i],
  ] as const;

  it.each(placeholders)('renders a coming-soon card for %s with no value', (key, labelRe) => {
    render(<DashboardSkeleton />);
    const card = screen.getByTestId(`dashboard-card-${key}`);
    expect(card).toBeInTheDocument();
    expect(card).toHaveTextContent(labelRe);
    expect(card).toHaveTextContent(/coming soon/i);
    expect(card).toHaveAttribute('data-functional', 'false');
  });

  it('renders no numeric metric anywhere (no fabricated figures)', () => {
    render(<DashboardSkeleton />);
    // The skeleton must contain no digits — any number would be fabricated.
    expect(screen.getByTestId('dashboard-skeleton')).not.toHaveTextContent(/\d/);
  });

  it('performs zero fetch calls on mount', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    render(<DashboardSkeleton />);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('performs zero localStorage access on mount', () => {
    const spy = vi.spyOn(window, 'localStorage', 'get');
    render(<DashboardSkeleton />);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

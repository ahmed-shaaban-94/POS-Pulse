/**
 * POS v3.5 Slice 5 — <DashboardView> (presentational, data-agnostic).
 *
 * The rich v3.5 dashboard LAYOUT (ws-head + stat-strip KPIs, sales-by-hour
 * sparkline, top-items panel, by-method + sync-health + quick-actions panels)
 * rendered purely from props. It owns NO data source: no fetch, no IPC, no
 * store access, no `import.meta.env` branch. That keeps it the durable shell —
 * dev feeds it sample data behind the DEMO banner today; when the DP-2 POS-013
 * dashboard-metrics contract lands, real data binds to this SAME component with
 * no rewrite. Honesty (real vs sample) is the CALLER's responsibility, not this
 * component's.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import { DashboardView } from '../DashboardView';
import type { DashboardViewModel } from '../DashboardView';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const VM: DashboardViewModel = {
  operatorName: 'Sample Operator',
  terminalLabel: 'TERM-01',
  shiftOpenedAt: '08:00',
  stats: [
    { key: 'sales', label: 'Sales', value: '23' },
    { key: 'gross', label: 'Gross', value: '¤1,240.00', tone: 'gold' },
    { key: 'drawer', label: 'Drawer', value: '¤1,790.00' },
    { key: 'credit', label: 'Credit', value: '¤120.00' },
  ],
  hourly: [
    { hour: '08', count: 1 },
    { hour: '09', count: 4 },
    { hour: '10', count: 2 },
  ],
  topItems: [{ name: 'باراسيتامول', count: 12 }],
  byMethod: [
    { label: 'Cash', count: 14 },
    { label: 'Card', count: 7 },
  ],
};

describe('DashboardView — presentational v3.5 layout', () => {
  it('renders the ws-head header with operator + terminal', () => {
    render(<DashboardView model={VM} />);
    expect(screen.getByRole('heading', { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByText(/Sample Operator/)).toBeInTheDocument();
    expect(screen.getByText(/TERM-01/)).toBeInTheDocument();
  });

  it('renders a stat cell per stat with its value', () => {
    render(<DashboardView model={VM} />);
    for (const s of VM.stats) {
      const cell = screen.getByTestId(`dashboard-stat-${s.key}`);
      expect(cell).toHaveTextContent(s.label);
      expect(cell).toHaveTextContent(s.value);
    }
  });

  it('renders a sparkline column per hourly bucket', () => {
    render(<DashboardView model={VM} />);
    const cols = screen.getAllByTestId('dashboard-spark-col');
    expect(cols).toHaveLength(VM.hourly.length);
  });

  it('renders top items, or an empty-state when none', () => {
    render(<DashboardView model={VM} />);
    expect(screen.getByText(/باراسيتامول/)).toBeInTheDocument();

    cleanup();
    render(<DashboardView model={{ ...VM, topItems: [] }} />);
    expect(screen.getByText(/no sales yet|لا مبيعات/i)).toBeInTheDocument();
  });

  it('owns no side effects — zero fetch + zero localStorage on mount', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const lsSpy = vi.spyOn(window, 'localStorage', 'get');
    render(<DashboardView model={VM} />);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(lsSpy).not.toHaveBeenCalled();
    lsSpy.mockRestore();
  });
});

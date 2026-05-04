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

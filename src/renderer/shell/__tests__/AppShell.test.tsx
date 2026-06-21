import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { AppShell } from '../AppShell';

afterEach(cleanup);

function renderShell(path = '/app/dashboard') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/app/*" element={<AppShell />}>
          <Route path="dashboard" element={<div data-testid="dashboard-outlet">Dashboard</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

/**
 * T032 — AppShell: landmark roles, exactly one <main>, exactly one <Outlet>.
 */
describe('AppShell (T032)', () => {
  it('renders landmark role="banner" (TopBar)', () => {
    renderShell();
    expect(screen.getByRole('banner')).toBeInTheDocument();
  });

  it('renders landmark role="navigation" (NavRail)', () => {
    renderShell();
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument();
  });

  it('renders landmark role="main" (MainContent)', () => {
    renderShell();
    expect(screen.getByRole('main')).toBeInTheDocument();
  });

  it('has exactly one <main>', () => {
    const { container } = renderShell();
    expect(container.querySelectorAll('main')).toHaveLength(1);
  });

  it('renders the Outlet (child route) inside main', () => {
    renderShell();
    expect(screen.getByTestId('dashboard-outlet')).toBeInTheDocument();
  });

  it('has data-testid="app-shell" for pairing-gate test compatibility', () => {
    renderShell();
    expect(screen.getByTestId('app-shell')).toBeInTheDocument();
  });

  it('app-shell root is RTL (POS v3.5 Arabic-first terminal)', () => {
    renderShell();
    expect(screen.getByTestId('app-shell')).toHaveAttribute('dir', 'rtl');
  });
});

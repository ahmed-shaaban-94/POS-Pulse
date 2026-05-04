import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';

import { TopBar } from '../TopBar';

afterEach(cleanup);

function renderTopBar(connectionState: 'online' | 'degraded' | 'offline' | 'syncing' = 'online') {
  return render(
    <MemoryRouter>
      <TopBar
        tenantId="Acme"
        branchId="Main St"
        terminalLabel="Counter 1"
        connectionState={connectionState}
      />
    </MemoryRouter>,
  );
}

/**
 * T031 — TopBar: composes IdentityStrip, ConnectionIndicator, OperatorSlot,
 * StatusBanner. Landmark role = banner.
 */
describe('TopBar (T031)', () => {
  it('has landmark role="banner"', () => {
    renderTopBar();
    expect(screen.getByRole('banner')).toBeInTheDocument();
  });

  it('renders IdentityStrip content', () => {
    renderTopBar();
    expect(screen.getByText('Acme')).toBeInTheDocument();
  });

  it('renders OperatorSlot "Sign in" button', () => {
    renderTopBar();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('StatusBanner is hidden when connection is online', () => {
    renderTopBar('online');
    // The status banner for online state renders nothing visible
    expect(screen.queryByText(/connection slow/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/offline/i)).not.toBeInTheDocument();
  });

  it('StatusBanner is visible for degraded state', () => {
    const { container } = renderTopBar('degraded');
    // Both ConnectionIndicator and StatusBanner render role="status";
    // use data-state attribute (unique to StatusBanner) to target it specifically.
    expect(container.querySelector('[data-state="degraded"]')).toBeInTheDocument();
  });
});

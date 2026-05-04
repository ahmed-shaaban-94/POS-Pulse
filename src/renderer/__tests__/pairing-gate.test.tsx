import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import { AppRouter } from '../router';
import type { PairingBridgeAPI } from '../../shared/bridge-api';
import type { PairingStatus } from '../../shared/pairing-types';

/**
 * T007 — Pairing-gate guard.
 *
 * Asserts that an unpaired or invalid terminal cannot reach /app/* routes.
 * The test exercises the existing 002 boot router unchanged — it passes
 * trivially at T007 time because no /app/* routes exist yet; the guard
 * catches any later regression that opens /app/* to unauthenticated/
 * unpaired state.
 *
 * This test MUST stay green after T035 adds /app routes.
 */

function makeBridge(status: PairingStatus): PairingBridgeAPI {
  return {
    getStatus: vi.fn(() => Promise.resolve(status)),
    submit: vi.fn(() => Promise.reject(new Error('submit not used in pairing gate test'))),
  };
}

afterEach(() => {
  cleanup();
  window.history.replaceState(null, '', '/');
});

describe('pairing-gate guard (T007)', () => {
  it('unpaired terminal routes to /pairing — not to /app/dashboard', async () => {
    const bridge = makeBridge({ kind: 'unpaired' });
    render(<AppRouter pairing={bridge} />);

    await waitFor(() => expect(screen.getByTestId('route-pairing')).toBeInTheDocument());

    expect(window.location.pathname).toBe('/pairing');
    expect(screen.queryByTestId('route-app-dashboard')).not.toBeInTheDocument();
    expect(screen.queryByTestId('app-shell')).not.toBeInTheDocument();
  });

  it('invalid/missing_token terminal routes to /pairing with reason flag', async () => {
    const bridge = makeBridge({ kind: 'invalid', reason: 'missing_token' });
    render(<AppRouter pairing={bridge} />);

    await waitFor(() => expect(screen.getByTestId('route-pairing')).toBeInTheDocument());

    expect(window.location.pathname).toBe('/pairing');
    expect(screen.getByTestId('route-pairing')).toHaveAttribute(
      'data-invalid-reason',
      'missing_token',
    );
    expect(screen.queryByTestId('app-shell')).not.toBeInTheDocument();
  });

  it('invalid/decrypt_failed terminal routes to /pairing', async () => {
    const bridge = makeBridge({ kind: 'invalid', reason: 'decrypt_failed' });
    render(<AppRouter pairing={bridge} />);

    await waitFor(() => expect(screen.getByTestId('route-pairing')).toBeInTheDocument());

    expect(window.location.pathname).toBe('/pairing');
    expect(screen.queryByTestId('app-shell')).not.toBeInTheDocument();
  });
});

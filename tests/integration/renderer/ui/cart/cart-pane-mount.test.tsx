import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import { CartPane } from '../../../../../src/renderer/ui/cart/CartPane.js';
import { useOperatorSessionStore } from '../../../../../src/renderer/stores/operator-session-store.js';
import { useCartStore } from '../../../../../src/renderer/stores/cart-store.js';
import type { OperatorSessionView } from '../../../../../src/renderer/stores/operator-session-store.js';

/**
 * T022 — CartPane mount integration test.
 *
 * Verifies the S1 shell behaviour:
 *   - CartPane renders only when an operator session is active (signed-in).
 *   - When signed out, the pane renders nothing visible (no leaked state).
 *   - The pane exposes a keyboard-focusable entry point (interactive
 *     control or labelled region) — accessibility is part of the FR-033
 *     visual direction gate.
 *
 * No `window.api` mock is required here: CartPane reads from the
 * renderer-side stores only. Bridge interactions are tested elsewhere.
 */

const SIGNED_IN_SESSION: OperatorSessionView = {
  id: 'sess-t022',
  operator_id: 'cashier-1',
  display_name: 'Test Cashier',
  role: 'cashier',
  tenant_id: 'tenant-1',
  branch_id: 'branch-1',
  started_at: '2026-05-14T08:00:00.000Z',
};

beforeEach(() => {
  useOperatorSessionStore.getState().reset();
  useCartStore.getState().reset();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('CartPane — mount visibility', () => {
  it('renders the pane when an operator session is signed in', () => {
    useOperatorSessionStore.getState().beginSignIn();
    useOperatorSessionStore.getState().resolveSignedIn(SIGNED_IN_SESSION);

    render(<CartPane />);

    const pane = screen.getByTestId('cart-pane');
    expect(pane).toBeInTheDocument();
  });

  it('does NOT render the pane when signed out', () => {
    render(<CartPane />);

    expect(screen.queryByTestId('cart-pane')).not.toBeInTheDocument();
  });

  it('renders the empty-cart placeholder when signed in and no active cart', () => {
    useOperatorSessionStore.getState().beginSignIn();
    useOperatorSessionStore.getState().resolveSignedIn(SIGNED_IN_SESSION);

    render(<CartPane />);

    expect(screen.getByTestId('cart-empty-placeholder')).toBeInTheDocument();
  });

  it('exposes an accessible name on the pane region', () => {
    useOperatorSessionStore.getState().beginSignIn();
    useOperatorSessionStore.getState().resolveSignedIn(SIGNED_IN_SESSION);

    render(<CartPane />);

    // The pane is labelled as "Cart" per S0 contact sheet (header strip).
    const pane = screen.getByRole('region', { name: /cart/i });
    expect(pane).toBeInTheDocument();
  });

  it('renders for manager role too', () => {
    useOperatorSessionStore.getState().beginSignIn();
    useOperatorSessionStore.getState().resolveSignedIn({
      ...SIGNED_IN_SESSION,
      role: 'manager',
    });

    render(<CartPane />);

    expect(screen.getByTestId('cart-pane')).toBeInTheDocument();
  });

  it('renders for admin role too', () => {
    useOperatorSessionStore.getState().beginSignIn();
    useOperatorSessionStore.getState().resolveSignedIn({
      ...SIGNED_IN_SESSION,
      role: 'admin',
    });

    render(<CartPane />);

    expect(screen.getByTestId('cart-pane')).toBeInTheDocument();
  });

  it('hides the empty placeholder when an active non-empty cart exists', () => {
    useOperatorSessionStore.getState().beginSignIn();
    useOperatorSessionStore.getState().resolveSignedIn(SIGNED_IN_SESSION);

    // Move the cart out of `empty` state so the empty placeholder is suppressed.
    useCartStore.getState().applyCartCreated('cart-uuid-populated');
    useCartStore.getState().applyLineAdded('line-1');

    render(<CartPane />);

    expect(screen.getByTestId('cart-pane')).toBeInTheDocument();
    expect(screen.queryByTestId('cart-empty-placeholder')).not.toBeInTheDocument();
  });

  it('renders the empty placeholder when active cart is still in empty state', () => {
    useOperatorSessionStore.getState().beginSignIn();
    useOperatorSessionStore.getState().resolveSignedIn(SIGNED_IN_SESSION);

    // applyCartCreated leaves state = empty.
    useCartStore.getState().applyCartCreated('cart-uuid-empty');

    render(<CartPane />);

    expect(screen.getByTestId('cart-empty-placeholder')).toBeInTheDocument();
  });
});

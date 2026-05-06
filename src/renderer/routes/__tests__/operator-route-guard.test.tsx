import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import '@testing-library/jest-dom/vitest';

import { OperatorRouteGuard } from '../operator-route-guard.js';
import {
  useOperatorSessionStore,
  type OperatorSessionView,
} from '../../stores/operator-session-store.js';

/**
 * 004-operator-session T010 — secondary UX defence (NFR-009 / AD-1).
 *
 * The guard redirects on `signedOut`, redirects on role-mismatch, and
 * allows on role-match. The PRIMARY trust gate is `requireRole` in
 * main-process bridge handlers — the test exists to verify the
 * RENDERER never paints content for an operator that lacks the role.
 */

const SAMPLE: OperatorSessionView = {
  id: 'sess-1',
  operator_id: 'op-1',
  display_name: 'Manager One',
  role: 'manager',
  tenant_id: 't1',
  branch_id: 'b1',
  started_at: '2026-05-06T00:00:00.000Z',
};

function renderAt(initialEntry: string): ReturnType<typeof render> {
  const router = createMemoryRouter(
    [
      {
        path: '/manager-only',
        element: (
          <OperatorRouteGuard allow={['manager', 'admin']}>
            <div data-testid="manager-content">manager surface</div>
          </OperatorRouteGuard>
        ),
      },
      {
        path: '/sign-in',
        element: <div data-testid="route-sign-in">sign-in surface</div>,
      },
    ],
    { initialEntries: [initialEntry] },
  );
  return render(<RouterProvider router={router} />);
}

afterEach(() => {
  useOperatorSessionStore.getState().reset();
  cleanup();
});

describe('OperatorRouteGuard (T010 — AD-1 secondary)', () => {
  it('redirects to /sign-in when signedOut', () => {
    renderAt('/manager-only');
    expect(screen.getByTestId('route-sign-in')).toBeInTheDocument();
    expect(screen.queryByTestId('manager-content')).not.toBeInTheDocument();
  });

  it('redirects to /sign-in on role mismatch (cashier visiting manager-only)', () => {
    useOperatorSessionStore.getState().beginSignIn();
    useOperatorSessionStore.getState().resolveSignedIn({ ...SAMPLE, role: 'cashier' });
    renderAt('/manager-only');
    expect(screen.getByTestId('route-sign-in')).toBeInTheDocument();
    expect(screen.queryByTestId('manager-content')).not.toBeInTheDocument();
  });

  it('allows on role match', () => {
    useOperatorSessionStore.getState().beginSignIn();
    useOperatorSessionStore.getState().resolveSignedIn(SAMPLE);
    renderAt('/manager-only');
    expect(screen.getByTestId('manager-content')).toBeInTheDocument();
    expect(screen.queryByTestId('route-sign-in')).not.toBeInTheDocument();
  });

  it('signingOut state redirects to /sign-in (not signedIn → no render)', () => {
    useOperatorSessionStore.getState().beginSignIn();
    useOperatorSessionStore.getState().resolveSignedIn(SAMPLE);
    useOperatorSessionStore.getState().beginSignOut();
    renderAt('/manager-only');
    expect(screen.getByTestId('route-sign-in')).toBeInTheDocument();
  });

  it('allow defaults to "any signed-in role" when omitted', () => {
    useOperatorSessionStore.getState().beginSignIn();
    useOperatorSessionStore.getState().resolveSignedIn({ ...SAMPLE, role: 'cashier' });
    const router = createMemoryRouter(
      [
        {
          path: '/any',
          element: (
            <OperatorRouteGuard>
              <div data-testid="any-content">any signed-in</div>
            </OperatorRouteGuard>
          ),
        },
        { path: '/sign-in', element: <div data-testid="route-sign-in">sign-in</div> },
      ],
      { initialEntries: ['/any'] },
    );
    render(<RouterProvider router={router} />);
    expect(screen.getByTestId('any-content')).toBeInTheDocument();
  });
});

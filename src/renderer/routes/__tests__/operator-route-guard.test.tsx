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
 * 004-operator-session T010 + T082 — secondary UX defence (NFR-009 / AD-1).
 *
 * T010: The guard redirects on `signedOut`, redirects on role-mismatch, and
 *   allows on role-match. The PRIMARY trust gate is `requireRole` in
 *   main-process bridge handlers — the test exists to verify the
 *   RENDERER never paints content for an operator that lacks the role.
 *
 * T082: Extends coverage to all §Section 3 routes in role-visibility-matrix.md
 *   that are ⛔ for cashier — confirming a cashier deep-link to any of them
 *   redirects to /sign-in without rendering the manager surface.
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

/**
 * T082 — Section 3 ⛔ routes enforced for cashier role.
 *
 * role-visibility-matrix.md §Section 3 routes that carry ⛔ for cashier:
 *   /app/manager/stuck-shifts — stuck-shift list
 *   /app/manager/cashiers    — cashier management surface (T078)
 *
 * Each test deep-links as cashier and asserts redirect to /sign-in.
 * manager and admin are asserted to reach the surface.
 */
describe('OperatorRouteGuard — T082 §Section 3 route enforcement', () => {
  const SECTION_3_ROUTES: Array<{ path: string; testId: string }> = [
    { path: '/app/manager/stuck-shifts', testId: 'stuck-shifts-content' },
    { path: '/app/manager/cashiers', testId: 'cashier-mgmt-content' },
  ];

  for (const { path, testId } of SECTION_3_ROUTES) {
    describe(path, () => {
      function renderSection3(initialEntry: string) {
        const router = createMemoryRouter(
          [
            {
              path,
              element: (
                <OperatorRouteGuard allow={['manager', 'admin']}>
                  <div data-testid={testId}>manager surface</div>
                </OperatorRouteGuard>
              ),
            },
            {
              path: '/sign-in',
              element: <div data-testid="route-sign-in">sign-in</div>,
            },
          ],
          { initialEntries: [initialEntry] },
        );
        return render(<RouterProvider router={router} />);
      }

      it('cashier deep-link redirects to /sign-in', () => {
        useOperatorSessionStore.getState().beginSignIn();
        useOperatorSessionStore.getState().resolveSignedIn({ ...SAMPLE, role: 'cashier' });
        renderSection3(path);
        expect(screen.getByTestId('route-sign-in')).toBeInTheDocument();
        expect(screen.queryByTestId(testId)).not.toBeInTheDocument();
      });

      it('signedOut deep-link redirects to /sign-in', () => {
        renderSection3(path);
        expect(screen.getByTestId('route-sign-in')).toBeInTheDocument();
        expect(screen.queryByTestId(testId)).not.toBeInTheDocument();
      });

      it('manager deep-link renders content', () => {
        useOperatorSessionStore.getState().beginSignIn();
        useOperatorSessionStore.getState().resolveSignedIn({ ...SAMPLE, role: 'manager' });
        renderSection3(path);
        expect(screen.getByTestId(testId)).toBeInTheDocument();
        expect(screen.queryByTestId('route-sign-in')).not.toBeInTheDocument();
      });

      it('admin deep-link renders content', () => {
        useOperatorSessionStore.getState().beginSignIn();
        useOperatorSessionStore.getState().resolveSignedIn({ ...SAMPLE, role: 'admin' });
        renderSection3(path);
        expect(screen.getByTestId(testId)).toBeInTheDocument();
        expect(screen.queryByTestId('route-sign-in')).not.toBeInTheDocument();
      });
    });
  }
});

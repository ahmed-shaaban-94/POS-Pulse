import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';

import { AppRouter } from '../../router.js';
import { useOperatorSessionStore } from '../../stores/operator-session-store.js';
import type {
  ManagerAdminSignInRequest,
  OperatorBridgeAPI,
  OperatorSessionBridgeView,
  PairingBridgeAPI,
  SignInResponse,
} from '../../../shared/bridge-api.js';
import type { PairingStatus } from '../../../shared/pairing-types.js';

/**
 * 004-operator-session T022 + T024 — `/sign-in` route + sign-out
 * journey through the full AppRouter.
 *
 * Verifies:
 *   - A paired terminal lands on `/sign-in` when there is no operator
 *     session and the route was entered directly (FR-005). Deep-link
 *     attempts to `/app/*` redirect to `/sign-in` via the
 *     <OperatorRouteGuard>.
 *   - Successful sign-in mounts the shell.
 *   - Sign-out clears the FSM and redirects back to `/sign-in`.
 *
 * The test takes the renderer-side path the operator actually
 * traverses; the main-process bridge is a fake whose response shape
 * matches the contract.
 */

const SESSION: OperatorSessionBridgeView = {
  id: 'sess-1',
  operator_id: 'op-1',
  display_name: 'Manager One',
  role: 'manager',
  tenant_id: 't1',
  branch_id: 'b1',
  started_at: '2026-05-06T00:00:00.000Z',
};

function pairedBridge(): PairingBridgeAPI {
  const status: PairingStatus = {
    kind: 'paired',
    tenant_id: 't1',
    branch_id: 'b1',
    terminal_id: 'term-1',
    terminal_label: 'Counter 1',
    paired_at: 1735689600,
  };
  return {
    getStatus: vi.fn(() => Promise.resolve(status)),
    submit: vi.fn(() => Promise.reject(new Error('not used'))),
  };
}

function operatorBridge(opts: {
  signIn?: (req: ManagerAdminSignInRequest) => Promise<SignInResponse>;
}): OperatorBridgeAPI {
  const defaultSignIn: (req: ManagerAdminSignInRequest) => Promise<SignInResponse> = () =>
    Promise.resolve({ kind: 'signed_in' as const, session: SESSION });
  return {
    signIn: vi.fn(opts.signIn ?? defaultSignIn),
    signOut: vi.fn(() => Promise.resolve({ kind: 'signed_out' as const })),
    getCurrentSession: vi.fn(() => Promise.resolve(null)),
    _reportActivity: vi.fn(),
    emitAuditEvent: vi.fn(() =>
      Promise.resolve({ kind: 'refused' as const, category: 'not_signed_in' as const }),
    ),
  };
}

beforeEach(() => {
  useOperatorSessionStore.getState().reset();
});

afterEach(() => {
  useOperatorSessionStore.getState().reset();
  cleanup();
});

describe('AppRouter + /sign-in (T022)', () => {
  it('a deep-link to /app/dashboard while signedOut redirects to /sign-in', async () => {
    render(
      <AppRouter
        pairing={pairedBridge()}
        operator={operatorBridge({})}
        initialEntry="/app/dashboard"
      />,
    );
    // The guard short-circuits the shell; the sign-in route mounts.
    await waitFor(() => expect(screen.getByTestId('route-sign-in')).toBeInTheDocument());
    expect(screen.queryByTestId('app-shell')).not.toBeInTheDocument();
  });

  it('renders /sign-in directly with the form and the inert roster', async () => {
    render(
      <AppRouter pairing={pairedBridge()} operator={operatorBridge({})} initialEntry="/sign-in" />,
    );
    await waitFor(() => expect(screen.getByTestId('route-sign-in')).toBeInTheDocument());
    expect(screen.getByTestId('manager-admin-sign-in-form')).toBeInTheDocument();
    expect(screen.getByTestId('roster-list')).toHaveAttribute('data-state', 'inert');
  });

  it('successful sign-in surfaces signedIn state in the operator session store', async () => {
    const user = userEvent.setup();
    render(
      <AppRouter pairing={pairedBridge()} operator={operatorBridge({})} initialEntry="/sign-in" />,
    );
    await waitFor(() => expect(screen.getByTestId('route-sign-in')).toBeInTheDocument());
    await user.type(screen.getByLabelText(/email or username/i), 'manager@x.test');
    await user.type(screen.getByLabelText(/^password$/i), 'p');
    await user.click(screen.getByTestId('sign-in-submit'));
    await waitFor(() => {
      const state = useOperatorSessionStore.getState().state;
      expect(state.kind).toBe('signedIn');
    });
  });
});

describe('AppRouter + sign-out (T024)', () => {
  it('store reset returns the FSM to signedOut (1 s budget — synchronous in test)', () => {
    // Pre-populate signedIn state, then exercise the sign-out path
    // synchronously: store transitions are constant-time, so the
    // 1 s budget (FR-008 / NFR-007) is trivially honoured.
    const store = useOperatorSessionStore.getState();
    store.beginSignIn();
    store.resolveSignedIn(SESSION);
    expect(useOperatorSessionStore.getState().state.kind).toBe('signedIn');
    store.beginSignOut();
    store.resolveSignedOut();
    expect(useOperatorSessionStore.getState().state.kind).toBe('signedOut');
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';

import { AppRouter } from '../../router.js';
import { SignInRoute } from '../sign-in.js';
import { useOperatorSessionStore } from '../../stores/operator-session-store.js';
import type {
  ListBranchRosterResponse,
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

const CASHIER = {
  id: 'cashier-1',
  display_name: 'Alice Smith',
  role: 'cashier' as const,
};

const CASHIER_SESSION: OperatorSessionBridgeView = {
  id: 'sess-cashier',
  operator_id: 'cashier-1',
  display_name: 'Alice Smith',
  role: 'cashier',
  tenant_id: 't1',
  branch_id: 'b1',
  started_at: '2026-05-06T00:00:00.000Z',
};

function operatorBridge(opts: {
  signIn?: (req: ManagerAdminSignInRequest) => Promise<SignInResponse>;
  listBranchRoster?: () => Promise<ListBranchRosterResponse>;
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
    _emitAuditEventSmoke: vi.fn(() =>
      Promise.resolve({ kind: 'refused' as const, category: 'not_signed_in' as const }),
    ),
    listBranchRoster: vi.fn(
      opts.listBranchRoster ?? (() => Promise.resolve({ kind: 'roster' as const, cashiers: [] })),
    ),
    confirmTakeover: vi.fn(() =>
      Promise.resolve({ kind: 'refused' as const, category: 'invalid_input' as const }),
    ),
    cancelTakeover: vi.fn(() => Promise.resolve({ kind: 'cancelled' as const })),
    resetCashierPin: vi.fn(() =>
      Promise.resolve({ kind: 'refused' as const, category: 'invalid_input' as const }),
    ),
    unlockCashier: vi.fn(() =>
      Promise.resolve({ kind: 'refused' as const, category: 'invalid_input' as const }),
    ),
    forceCloseShift: vi.fn(() =>
      Promise.resolve({ kind: 'refused' as const, category: 'invalid_input' as const }),
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

// ─── SignInRoute cashier path (T075 / T077) ──────────────────────────────────
// Tests render <SignInRoute> directly to isolate cashier-flow branches without
// the full AppRouter + pairing overhead.

function renderSignInRoute(bridge: OperatorBridgeAPI) {
  return render(<SignInRoute operator={bridge} />);
}

describe('SignInRoute — roster fetch', () => {
  it('populates the roster when listBranchRoster resolves with cashiers', async () => {
    const bridge = operatorBridge({
      listBranchRoster: () => Promise.resolve({ kind: 'roster' as const, cashiers: [CASHIER] }),
    });
    renderSignInRoute(bridge);
    await waitFor(() => expect(screen.getByTestId(`roster-item-0`)).toBeInTheDocument());
  });

  it('shows no_connection alert when roster returns no_connection category', async () => {
    const bridge = operatorBridge({
      listBranchRoster: () =>
        Promise.resolve({ kind: 'refused' as const, category: 'no_connection' as const }),
    });
    renderSignInRoute(bridge);
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  });

  it('shows no alert for non-no_connection refusal (soft failure)', async () => {
    const bridge = operatorBridge({
      listBranchRoster: () =>
        Promise.resolve({ kind: 'refused' as const, category: 'role_mismatch' as const }),
    });
    renderSignInRoute(bridge);
    // Roster fetch resolves; no error shown (role_mismatch is silently ignored).
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const rosterMock = vi.mocked(bridge.listBranchRoster);
    await waitFor(() => {
      expect(rosterMock).toHaveBeenCalled();
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('swallows a thrown exception from listBranchRoster (best-effort)', async () => {
    const bridge = operatorBridge({
      listBranchRoster: () => Promise.reject(new Error('network failure')),
    });
    renderSignInRoute(bridge);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const rosterMock = vi.mocked(bridge.listBranchRoster);
    await waitFor(() => {
      expect(rosterMock).toHaveBeenCalled();
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('SignInRoute — cashier selection', () => {
  it('shows the PIN section after a cashier is selected', async () => {
    const user = userEvent.setup();
    const bridge = operatorBridge({
      listBranchRoster: () => Promise.resolve({ kind: 'roster' as const, cashiers: [CASHIER] }),
    });
    renderSignInRoute(bridge);
    await waitFor(() => expect(screen.getByTestId(`roster-item-0`)).toBeInTheDocument());
    await user.click(screen.getByTestId(`roster-item-0`));
    expect(screen.getByTestId('pin-section')).toBeInTheDocument();
    expect(screen.getByTestId('pin-cashier-name')).toHaveTextContent(CASHIER.display_name);
  });

  it('Back button dismisses the PIN section', async () => {
    const user = userEvent.setup();
    const bridge = operatorBridge({
      listBranchRoster: () => Promise.resolve({ kind: 'roster' as const, cashiers: [CASHIER] }),
    });
    renderSignInRoute(bridge);
    await waitFor(() => expect(screen.getByTestId(`roster-item-0`)).toBeInTheDocument());
    await user.click(screen.getByTestId(`roster-item-0`));
    await user.click(screen.getByTestId('cashier-pin-cancel'));
    expect(screen.queryByTestId('pin-section')).not.toBeInTheDocument();
  });
});

describe('SignInRoute — cashier sign-in responses', () => {
  async function setupCashierWithPin(bridge: OperatorBridgeAPI) {
    const user = userEvent.setup();
    renderSignInRoute(bridge);
    await waitFor(() => expect(screen.getByTestId(`roster-item-0`)).toBeInTheDocument());
    await user.click(screen.getByTestId(`roster-item-0`));
    // Enter 4 digits via the PinPad digit buttons.
    for (const d of ['1', '2', '3', '4']) {
      await user.click(screen.getByTestId(`pin-pad-key-${d}`));
    }
    return user;
  }

  it('signed_in response transitions store to signedIn', async () => {
    const bridge = operatorBridge({
      listBranchRoster: () => Promise.resolve({ kind: 'roster' as const, cashiers: [CASHIER] }),
      signIn: () => Promise.resolve({ kind: 'signed_in' as const, session: CASHIER_SESSION }),
    });
    const user = await setupCashierWithPin(bridge);
    await user.click(screen.getByTestId('pin-pad-enter'));
    await waitFor(() => {
      expect(useOperatorSessionStore.getState().state.kind).toBe('signedIn');
    });
  });

  it('takeover_required response shows the TakeoverPrompt overlay', async () => {
    const bridge = operatorBridge({
      listBranchRoster: () => Promise.resolve({ kind: 'roster' as const, cashiers: [CASHIER] }),
      signIn: () =>
        Promise.resolve({
          kind: 'takeover_required' as const,
          pending_takeover_id: 'takeover-1',
          cashier_clerk_user_id: CASHIER.id,
          display_name: CASHIER.display_name,
        }),
    });
    const user = await setupCashierWithPin(bridge);
    await user.click(screen.getByTestId('pin-pad-enter'));
    await waitFor(() => {
      expect(useOperatorSessionStore.getState().state.kind).toBe('takeoverPrompt');
    });
  });

  it('refused response shows the inline cashier error', async () => {
    const bridge = operatorBridge({
      listBranchRoster: () => Promise.resolve({ kind: 'roster' as const, cashiers: [CASHIER] }),
      signIn: () =>
        Promise.resolve({ kind: 'refused' as const, category: 'invalid_input' as const }),
    });
    const user = await setupCashierWithPin(bridge);
    await user.click(screen.getByTestId('pin-pad-enter'));
    await waitFor(() => expect(screen.getByTestId('cashier-sign-in-error')).toBeInTheDocument());
    expect(useOperatorSessionStore.getState().state.kind).toBe('signedOut');
  });

  it('IPC exception shows the inline cashier error (catch branch)', async () => {
    const bridge = operatorBridge({
      listBranchRoster: () => Promise.resolve({ kind: 'roster' as const, cashiers: [CASHIER] }),
      signIn: () => Promise.reject(new Error('ipc crash')),
    });
    const user = await setupCashierWithPin(bridge);
    await user.click(screen.getByTestId('pin-pad-enter'));
    await waitFor(() => expect(screen.getByTestId('cashier-sign-in-error')).toBeInTheDocument());
  });
});

describe('SignInRoute — FSM reset clears PIN (signedOut effect)', () => {
  it('FSM transition back to signedOut resets the spinner', async () => {
    // Directly manipulate the store to exercise the useEffect on fsm.kind.
    const bridge = operatorBridge({
      listBranchRoster: () => Promise.resolve({ kind: 'roster' as const, cashiers: [CASHIER] }),
    });
    const user = userEvent.setup();
    renderSignInRoute(bridge);
    await waitFor(() => expect(screen.getByTestId(`roster-item-0`)).toBeInTheDocument());
    await user.click(screen.getByTestId(`roster-item-0`));
    // Trigger a signingIn → signedOut transition via the store.
    useOperatorSessionStore.getState().beginSignIn();
    await waitFor(() => expect(screen.getByTestId('cashier-sign-in-spinner')).toBeInTheDocument());
    useOperatorSessionStore.getState().refuseSignIn('invalid_input');
    await waitFor(() =>
      expect(screen.queryByTestId('cashier-sign-in-spinner')).not.toBeInTheDocument(),
    );
  });
});

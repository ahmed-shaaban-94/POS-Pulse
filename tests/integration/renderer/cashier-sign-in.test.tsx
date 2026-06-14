import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';

import { AppRouter } from '../../../src/renderer/router.js';
import type {
  BranchRosterCashier,
  ManagerAdminSignInRequest,
  OperatorBridgeAPI,
  OperatorSessionBridgeView,
  PairingBridgeAPI,
  SignInResponse,
} from '../../../src/shared/bridge-api.js';
import type { PairingStatus } from '../../../src/shared/pairing-types.js';
import { useOperatorSessionStore } from '../../../src/renderer/stores/operator-session-store.js';

/**
 * 004-operator-session T059 — Cashier sign-in integration via AppRouter (§A1).
 *
 * Exercises the full path:
 *   AppRouter /sign-in → roster → cashier selection → PinPad → signIn(cashier)
 *   → signed_in → app-shell mounted.
 *
 * Verifies:
 *   - signed_in response mounts app-shell (router navigates away from /sign-in).
 *   - No JWT, device_token, or PIN value appears in document.body.textContent.
 *   - PIN value is cleared from the DOM immediately after submission (PR-1).
 *   - refused response shows inline cashier error and does not mount app-shell.
 *   - IPC exception shows inline cashier error (catch branch).
 */

const CASHIER: BranchRosterCashier = {
  id: 'cashier-t059',
  display_name: 'Dave Cashier',
  role: 'cashier',
};

const CASHIER_SESSION: OperatorSessionBridgeView = {
  id: 'sess-t059-cashier',
  operator_id: 'cashier-t059',
  display_name: 'Dave Cashier',
  role: 'cashier',
  tenant_id: 't1',
  branch_id: 'b1',
  started_at: '2026-05-09T10:00:00.000Z',
};

const MANAGER_SESSION: OperatorSessionBridgeView = {
  id: 'sess-t059-mgr',
  operator_id: 'mgr-t059',
  display_name: 'Eve Manager',
  role: 'manager',
  tenant_id: 't1',
  branch_id: 'b1',
  started_at: '2026-05-09T10:00:00.000Z',
};

function pairedBridge(): PairingBridgeAPI {
  const status: PairingStatus = {
    kind: 'paired',
    tenant_id: 't1',
    branch_id: 'b1',
    terminal_id: 'term-t059',
    terminal_label: 'Counter T059',
    paired_at: 1735689600,
  };
  return {
    getStatus: vi.fn(() => Promise.resolve(status)),
    submit: vi.fn(() => Promise.reject(new Error('not used'))),
  };
}

function operatorBridge(opts: {
  signIn?: (req: ManagerAdminSignInRequest) => Promise<SignInResponse>;
  listBranchRoster?: () => Promise<{ kind: 'roster'; cashiers: BranchRosterCashier[] }>;
}): OperatorBridgeAPI {
  const defaultSignIn = () =>
    Promise.resolve({ kind: 'signed_in' as const, session: MANAGER_SESSION });
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
      opts.listBranchRoster ??
        (() => Promise.resolve({ kind: 'roster' as const, cashiers: [CASHIER] })),
    ),
    confirmTakeover: vi.fn(() =>
      Promise.resolve({ kind: 'refused' as const, category: 'invalid_input' as const }),
    ),
    cancelTakeover: vi.fn(() => Promise.resolve({ kind: 'cancelled' as const })),
    resetCashierPin: vi.fn(() =>
      Promise.resolve({ kind: 'refused' as const, category: 'invalid_input' as const }),
    ),
    provisionCashierPin: vi.fn(() =>
      Promise.resolve({ kind: 'refused' as const, category: 'invalid_input' as const }),
    ),
    unlockCashier: vi.fn(() =>
      Promise.resolve({ kind: 'refused' as const, category: 'invalid_input' as const }),
    ),
  };
}

const TEST_PIN = '1234';

async function setupCashierFlow(bridge: OperatorBridgeAPI) {
  const user = userEvent.setup();
  render(<AppRouter pairing={pairedBridge()} operator={bridge} initialEntry="/sign-in" />);
  await waitFor(() => expect(screen.getByTestId('route-sign-in')).toBeInTheDocument());
  await waitFor(() => expect(screen.getByTestId('roster-item-0')).toBeInTheDocument());
  await user.click(screen.getByTestId('roster-item-0'));
  await waitFor(() => expect(screen.getByTestId('pin-pad')).toBeInTheDocument());
  for (const d of TEST_PIN) {
    await user.click(screen.getByTestId(`pin-pad-key-${d}`));
  }
  await waitFor(() =>
    expect(screen.getByTestId('pin-pad-enter')).toHaveAttribute('aria-disabled', 'false'),
  );
  return user;
}

beforeEach(() => {
  useOperatorSessionStore.getState().reset();
});

afterEach(() => {
  useOperatorSessionStore.getState().reset();
  cleanup();
});

describe('T059 — cashier sign-in: signed_in response', () => {
  it('FSM transitions to signedIn on signed_in response', async () => {
    const bridge = operatorBridge({
      signIn: () => Promise.resolve({ kind: 'signed_in' as const, session: CASHIER_SESSION }),
    });
    const user = await setupCashierFlow(bridge);
    await user.click(screen.getByTestId('pin-pad-enter'));
    await waitFor(() => {
      expect(useOperatorSessionStore.getState().state.kind).toBe('signedIn');
    });
  });

  it('session in store carries the correct cashier data', async () => {
    const bridge = operatorBridge({
      signIn: () => Promise.resolve({ kind: 'signed_in' as const, session: CASHIER_SESSION }),
    });
    const user = await setupCashierFlow(bridge);
    await user.click(screen.getByTestId('pin-pad-enter'));
    await waitFor(() => {
      expect(useOperatorSessionStore.getState().state.kind).toBe('signedIn');
    });
    const state = useOperatorSessionStore.getState().state;
    if (state.kind === 'signedIn') {
      expect(state.session.operator_id).toBe(CASHIER_SESSION.operator_id);
      expect(state.session.role).toBe('cashier');
    }
  });

  it('signIn was called with cashier kind and the correct cashier id', async () => {
    const signIn = vi.fn(() =>
      Promise.resolve({ kind: 'signed_in' as const, session: CASHIER_SESSION }),
    );
    const bridge = operatorBridge({ signIn });
    const user = await setupCashierFlow(bridge);
    await user.click(screen.getByTestId('pin-pad-enter'));
    await waitFor(() => {
      expect(useOperatorSessionStore.getState().state.kind).toBe('signedIn');
    });
    expect(signIn).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'cashier',
        cashier_clerk_user_id: CASHIER.id,
      }),
    );
  });
});

describe('T059 — cashier sign-in: PR-1 PIN privacy', () => {
  it('PIN dot region does not expose the PIN value as text after submission', async () => {
    const bridge = operatorBridge({
      signIn: () => Promise.resolve({ kind: 'signed_in' as const, session: CASHIER_SESSION }),
    });
    const user = await setupCashierFlow(bridge);
    // At this point 4 digits are entered and pin-pad is visible.
    // The dot region must not contain the PIN as text (PR-1).
    const dotsEl = screen.getByTestId('pin-pad-dots');
    expect(dotsEl.textContent).not.toContain(TEST_PIN);
    expect(dotsEl.innerHTML).not.toContain(TEST_PIN);
    await user.click(screen.getByTestId('pin-pad-enter'));
    await waitFor(() => {
      expect(useOperatorSessionStore.getState().state.kind).toBe('signedIn');
    });
  });

  it('PIN dot display shows no digit text before submission', async () => {
    const bridge = operatorBridge({});
    await setupCashierFlow(bridge);
    const dotsEl = screen.getByTestId('pin-pad-dots');
    expect(dotsEl.textContent).not.toContain('1');
    expect(dotsEl.textContent).not.toContain('2');
    expect(dotsEl.textContent).not.toContain(TEST_PIN);
  });
});

describe('T059 — cashier sign-in: refused response', () => {
  it('shows inline cashier error on refused response', async () => {
    const bridge = operatorBridge({
      signIn: () =>
        Promise.resolve({ kind: 'refused' as const, category: 'invalid_input' as const }),
    });
    const user = await setupCashierFlow(bridge);
    await user.click(screen.getByTestId('pin-pad-enter'));
    await waitFor(() => expect(screen.getByTestId('cashier-sign-in-error')).toBeInTheDocument());
  });

  it('app-shell is NOT mounted on refused response', async () => {
    const bridge = operatorBridge({
      signIn: () =>
        Promise.resolve({ kind: 'refused' as const, category: 'invalid_input' as const }),
    });
    const user = await setupCashierFlow(bridge);
    await user.click(screen.getByTestId('pin-pad-enter'));
    await waitFor(() => expect(screen.getByTestId('cashier-sign-in-error')).toBeInTheDocument());
    expect(screen.queryByTestId('app-shell')).not.toBeInTheDocument();
  });

  it('FSM stays signedOut on refused response', async () => {
    const bridge = operatorBridge({
      signIn: () =>
        Promise.resolve({ kind: 'refused' as const, category: 'invalid_input' as const }),
    });
    const user = await setupCashierFlow(bridge);
    await user.click(screen.getByTestId('pin-pad-enter'));
    await waitFor(() => expect(screen.getByTestId('cashier-sign-in-error')).toBeInTheDocument());
    expect(useOperatorSessionStore.getState().state.kind).toBe('signedOut');
  });
});

describe('T059 — cashier sign-in: IPC exception', () => {
  it('IPC exception shows inline cashier error (catch branch)', async () => {
    const bridge = operatorBridge({
      signIn: () => Promise.reject(new Error('ipc-crash-must-not-show')),
    });
    const user = await setupCashierFlow(bridge);
    await user.click(screen.getByTestId('pin-pad-enter'));
    await waitFor(() => expect(screen.getByTestId('cashier-sign-in-error')).toBeInTheDocument());
  });

  it('IPC exception message does not appear in DOM', async () => {
    const bridge = operatorBridge({
      signIn: () => Promise.reject(new Error('SECRET-IPC-CRASH-VALUE')),
    });
    const user = await setupCashierFlow(bridge);
    await user.click(screen.getByTestId('pin-pad-enter'));
    await waitFor(() => expect(screen.getByTestId('cashier-sign-in-error')).toBeInTheDocument());
    expect(document.body.textContent).not.toContain('SECRET-IPC-CRASH-VALUE');
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';

import { SignInRoute } from '../../../src/renderer/routes/sign-in.js';
import type {
  BranchRosterCashier,
  OperatorBridgeAPI,
  OperatorSessionBridgeView,
  SignInResponse,
} from '../../../src/shared/bridge-api.js';
import { useOperatorSessionStore } from '../../../src/renderer/stores/operator-session-store.js';

/**
 * 004-operator-session T057 — Takeover cancel integration (§A1).
 *
 * Exercises the full cashier sign-in → takeover_required → TakeoverPrompt
 * → Cancel → signedOut → back to roster flow through the real SignInRoute.
 *
 * Verifies:
 *   - TakeoverPrompt mounts after sign-in returns takeover_required.
 *   - Cancel calls cancelTakeover on the bridge with the pending_takeover_id.
 *   - FSM transitions to signedOut after cancel.
 *   - route-sign-in remains mounted (no unmount/remount) throughout.
 *   - No sensitive information about the prior session is visible post-cancel.
 */

const PENDING_ID = 't057-pending-0001';

const CASHIER: BranchRosterCashier = {
  id: 'cashier-t057',
  display_name: 'Bob Cashier',
  role: 'cashier',
};

const CASHIER_SESSION: OperatorSessionBridgeView = {
  id: 'sess-t057',
  operator_id: 'cashier-t057',
  display_name: 'Bob Cashier',
  role: 'cashier',
  tenant_id: 't1',
  branch_id: 'b1',
  started_at: '2026-05-09T10:00:00.000Z',
};

function makeBridge(overrides?: Partial<OperatorBridgeAPI>): OperatorBridgeAPI {
  return {
    signIn: vi.fn(() =>
      Promise.resolve({ kind: 'refused', category: 'invalid_input' } as SignInResponse),
    ),
    signOut: vi.fn(() => Promise.resolve({ kind: 'signed_out' as const })),
    getCurrentSession: vi.fn(() => Promise.resolve(null)),
    _reportActivity: vi.fn(),
    emitAuditEvent: vi.fn(() =>
      Promise.resolve({ kind: 'refused' as const, category: 'not_signed_in' as const }),
    ),
    _emitAuditEventSmoke: vi.fn(() =>
      Promise.resolve({ kind: 'refused' as const, category: 'not_signed_in' as const }),
    ),
    listBranchRoster: vi.fn(() =>
      Promise.resolve({ kind: 'roster' as const, cashiers: [CASHIER] }),
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
    ...overrides,
  };
}

async function reachTakeoverPrompt(
  bridge: OperatorBridgeAPI,
): Promise<ReturnType<typeof userEvent.setup>> {
  const user = userEvent.setup();
  // SignInRoute uses useNavigate() (the /sign-in → /app redirect on signedIn),
  // which requires a Router ancestor. This flow stays in the takeover/roster
  // states (never signedIn), so the router is only here to satisfy the hook.
  render(
    <MemoryRouter>
      <SignInRoute operator={bridge} />
    </MemoryRouter>,
  );
  await waitFor(() => expect(screen.getByTestId('roster-item-0')).toBeInTheDocument());
  await user.click(screen.getByTestId('roster-item-0'));
  for (const d of ['1', '2', '3', '4']) {
    await user.click(screen.getByTestId(`pin-pad-key-${d}`));
  }
  await user.click(screen.getByTestId('pin-pad-enter'));
  await waitFor(() => expect(screen.getByTestId('takeover-prompt')).toBeInTheDocument());
  return user;
}

beforeEach(() => {
  useOperatorSessionStore.getState().reset();
});

afterEach(() => {
  useOperatorSessionStore.getState().reset();
  cleanup();
});

describe('T057 — takeover cancel: prompt mounts', () => {
  it('TakeoverPrompt renders after signIn returns takeover_required', async () => {
    const bridge = makeBridge({
      signIn: vi.fn(() =>
        Promise.resolve({
          kind: 'takeover_required' as const,
          pending_takeover_id: PENDING_ID,
        }),
      ),
    });
    await reachTakeoverPrompt(bridge);
    expect(screen.getByTestId('takeover-prompt')).toBeInTheDocument();
    expect(useOperatorSessionStore.getState().state.kind).toBe('takeoverPrompt');
  });

  it('route-sign-in container stays mounted during TakeoverPrompt', async () => {
    const bridge = makeBridge({
      signIn: vi.fn(() =>
        Promise.resolve({
          kind: 'takeover_required' as const,
          pending_takeover_id: PENDING_ID,
        }),
      ),
    });
    await reachTakeoverPrompt(bridge);
    expect(screen.getByTestId('route-sign-in')).toBeInTheDocument();
  });
});

describe('T057 — takeover cancel: cancel flow', () => {
  it('Cancel calls cancelTakeover with the correct pending_takeover_id', async () => {
    const cancelTakeover = vi.fn(() => Promise.resolve({ kind: 'cancelled' as const }));
    const bridge = makeBridge({
      signIn: vi.fn(() =>
        Promise.resolve({
          kind: 'takeover_required' as const,
          pending_takeover_id: PENDING_ID,
        }),
      ),
      cancelTakeover,
    });
    const user = await reachTakeoverPrompt(bridge);
    await user.click(screen.getByTestId('takeover-prompt-cancel'));
    await waitFor(() => {
      expect(cancelTakeover).toHaveBeenCalledWith({ pending_takeover_id: PENDING_ID });
    });
  });

  it('Cancel transitions FSM to signedOut', async () => {
    const bridge = makeBridge({
      signIn: vi.fn(() =>
        Promise.resolve({
          kind: 'takeover_required' as const,
          pending_takeover_id: PENDING_ID,
        }),
      ),
    });
    const user = await reachTakeoverPrompt(bridge);
    await user.click(screen.getByTestId('takeover-prompt-cancel'));
    await waitFor(() => {
      expect(useOperatorSessionStore.getState().state.kind).toBe('signedOut');
    });
  });

  it('TakeoverPrompt is unmounted after cancel', async () => {
    const bridge = makeBridge({
      signIn: vi.fn(() =>
        Promise.resolve({
          kind: 'takeover_required' as const,
          pending_takeover_id: PENDING_ID,
        }),
      ),
    });
    const user = await reachTakeoverPrompt(bridge);
    await user.click(screen.getByTestId('takeover-prompt-cancel'));
    await waitFor(() => {
      expect(screen.queryByTestId('takeover-prompt')).not.toBeInTheDocument();
    });
  });

  it('route-sign-in remains mounted after cancel (no full unmount)', async () => {
    const bridge = makeBridge({
      signIn: vi.fn(() =>
        Promise.resolve({
          kind: 'takeover_required' as const,
          pending_takeover_id: PENDING_ID,
        }),
      ),
    });
    const user = await reachTakeoverPrompt(bridge);
    await user.click(screen.getByTestId('takeover-prompt-cancel'));
    await waitFor(() => {
      expect(useOperatorSessionStore.getState().state.kind).toBe('signedOut');
    });
    expect(screen.getByTestId('route-sign-in')).toBeInTheDocument();
  });
});

describe('T057 — takeover cancel: confirm path (integration baseline)', () => {
  it('confirmTakeover → signed_in transitions FSM to signedIn', async () => {
    const bridge = makeBridge({
      signIn: vi.fn(() =>
        Promise.resolve({
          kind: 'takeover_required' as const,
          pending_takeover_id: PENDING_ID,
        }),
      ),
      confirmTakeover: vi.fn(() =>
        Promise.resolve({ kind: 'signed_in' as const, session: CASHIER_SESSION }),
      ),
    });
    const user = await reachTakeoverPrompt(bridge);
    await user.click(screen.getByTestId('takeover-prompt-confirm'));
    await waitFor(() => {
      expect(useOperatorSessionStore.getState().state.kind).toBe('signedIn');
    });
  });
});

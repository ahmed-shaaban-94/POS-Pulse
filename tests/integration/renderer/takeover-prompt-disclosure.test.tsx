import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';

import { SignInRoute } from '../../../src/renderer/routes/sign-in.js';
import type {
  BranchRosterCashier,
  OperatorBridgeAPI,
  SignInResponse,
} from '../../../src/shared/bridge-api.js';
import { useOperatorSessionStore } from '../../../src/renderer/stores/operator-session-store.js';

/**
 * 004-operator-session T058 — TakeoverPrompt minimum-disclosure at route level (§A1).
 *
 * FR-013 minimum-disclosure: route-level view — asserts that the full
 * `route-sign-in` container (including TakeoverPrompt) does not leak
 * any identifying or time-based information about the conflicting session.
 *
 * Distinct from TakeoverPrompt.forbidden-strings.test.tsx (component-only):
 * this exercises the complete route surface (roster → sign-in → takeover).
 *
 * Canonical copy (locked by visual-direction spec):
 *   Heading : "You are already signed in on another POS terminal in this branch."
 *   Body    : "Continue here and sign out there?"
 *   Primary : "Continue here"
 *   Ghost   : "Cancel"
 *
 * Forbidden strings (FR-013):
 *   - POS-<id>  (terminal identifier pattern)
 *   - "ago"     (time-relative string)
 *   - "Cashier " (role label, trailing space)
 *   - "Manager" (role label)
 *   - "Admin"   (role label)
 *   - /\d{2}:\d{2}/ (HH:MM timestamp pattern)
 *   - "View details" / "Show details" / "Why am I seeing this"
 *   - The pending_takeover_id token itself
 */

const PENDING_ID = 't058-pending-0001';

const CASHIER: BranchRosterCashier = {
  id: 'cashier-t058',
  display_name: 'Carol Cashier',
  role: 'cashier',
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

beforeEach(() => {
  useOperatorSessionStore.getState().reset();
});

afterEach(() => {
  useOperatorSessionStore.getState().reset();
  cleanup();
});

// ─── Store-seeded path (no full cashier flow needed for disclosure tests) ───

describe('T058 — FR-013 canonical copy at route level (store-seeded)', () => {
  beforeEach(() => {
    useOperatorSessionStore.setState({
      state: { kind: 'takeoverPrompt', pending_takeover_id: PENDING_ID },
    });
  });

  it('heading is exactly the canonical FR-013 string', () => {
    render(<SignInRoute operator={makeBridge()} />);
    expect(screen.getByTestId('takeover-prompt-title').textContent).toBe(
      'You are already signed in on another POS terminal in this branch.',
    );
  });

  it('body is exactly the canonical FR-013 string', () => {
    render(<SignInRoute operator={makeBridge()} />);
    expect(screen.getByTestId('takeover-prompt-body').textContent).toBe(
      'Continue here and sign out there?',
    );
  });

  it('primary button label is exactly "Continue here"', () => {
    render(<SignInRoute operator={makeBridge()} />);
    expect(screen.getByTestId('takeover-prompt-confirm').textContent).toBe('Continue here');
  });

  it('ghost button label is exactly "Cancel"', () => {
    render(<SignInRoute operator={makeBridge()} />);
    expect(screen.getByTestId('takeover-prompt-cancel').textContent).toBe('Cancel');
  });
});

describe('T058 — FR-013 forbidden strings at route level (store-seeded)', () => {
  beforeEach(() => {
    useOperatorSessionStore.setState({
      state: { kind: 'takeoverPrompt', pending_takeover_id: PENDING_ID },
    });
  });

  it('route-sign-in does NOT contain any POS-<id> terminal identifier', () => {
    render(<SignInRoute operator={makeBridge()} />);
    expect(screen.getByTestId('route-sign-in').textContent).not.toMatch(/POS-\w/);
  });

  it('route-sign-in does NOT contain "ago" (time-relative string)', () => {
    render(<SignInRoute operator={makeBridge()} />);
    expect(screen.getByTestId('route-sign-in').textContent).not.toMatch(/\bago\b/);
  });

  it('route-sign-in does NOT contain "Cashier " (role label)', () => {
    render(<SignInRoute operator={makeBridge()} />);
    expect(screen.getByTestId('route-sign-in').textContent).not.toMatch(/Cashier /);
  });

  it('route-sign-in does NOT contain "Manager" (role label)', () => {
    render(<SignInRoute operator={makeBridge()} />);
    expect(screen.getByTestId('route-sign-in').textContent).not.toMatch(/Manager/);
  });

  it('route-sign-in does NOT contain "Admin" (role label)', () => {
    render(<SignInRoute operator={makeBridge()} />);
    expect(screen.getByTestId('route-sign-in').textContent).not.toMatch(/Admin/);
  });

  it('route-sign-in does NOT contain HH:MM timestamp pattern', () => {
    render(<SignInRoute operator={makeBridge()} />);
    expect(screen.getByTestId('route-sign-in').textContent).not.toMatch(/\d{2}:\d{2}/);
  });

  it('route-sign-in does NOT contain "View details"', () => {
    render(<SignInRoute operator={makeBridge()} />);
    expect(screen.getByTestId('route-sign-in').textContent).not.toMatch(/View details/i);
  });

  it('route-sign-in does NOT contain "Show details"', () => {
    render(<SignInRoute operator={makeBridge()} />);
    expect(screen.getByTestId('route-sign-in').textContent).not.toMatch(/Show details/i);
  });

  it('route-sign-in does NOT contain "Why am I seeing this"', () => {
    render(<SignInRoute operator={makeBridge()} />);
    expect(screen.getByTestId('route-sign-in').textContent).not.toMatch(/Why am I seeing this/i);
  });

  it('route-sign-in does NOT expose the pending_takeover_id in rendered text', () => {
    render(<SignInRoute operator={makeBridge()} />);
    expect(screen.getByTestId('route-sign-in').textContent).not.toContain(PENDING_ID);
  });
});

// ─── Live flow path (cashier selection → PIN entry → takeover_required) ──────

describe('T058 — FR-013 forbidden strings after live cashier takeover flow', () => {
  it('route-sign-in does not expose pending_takeover_id after live flow', async () => {
    const user = userEvent.setup();
    const bridge = makeBridge({
      signIn: vi.fn(() =>
        Promise.resolve({
          kind: 'takeover_required' as const,
          pending_takeover_id: PENDING_ID,
        }),
      ),
    });
    render(<SignInRoute operator={bridge} />);
    await waitFor(() =>
      expect(screen.getByTestId(`roster-item-${CASHIER.id}`)).toBeInTheDocument(),
    );
    await user.click(screen.getByTestId(`roster-item-${CASHIER.id}`));
    for (const d of ['1', '2', '3', '4']) {
      await user.click(screen.getByTestId(`pin-pad-key-${d}`));
    }
    await user.click(screen.getByTestId('pin-pad-enter'));
    await waitFor(() => expect(screen.getByTestId('takeover-prompt')).toBeInTheDocument());
    expect(screen.getByTestId('route-sign-in').textContent).not.toContain(PENDING_ID);
  });

  it('route-sign-in does not show role labels after live flow', async () => {
    const user = userEvent.setup();
    const bridge = makeBridge({
      signIn: vi.fn(() =>
        Promise.resolve({
          kind: 'takeover_required' as const,
          pending_takeover_id: PENDING_ID,
        }),
      ),
    });
    render(<SignInRoute operator={bridge} />);
    await waitFor(() =>
      expect(screen.getByTestId(`roster-item-${CASHIER.id}`)).toBeInTheDocument(),
    );
    await user.click(screen.getByTestId(`roster-item-${CASHIER.id}`));
    for (const d of ['1', '2', '3', '4']) {
      await user.click(screen.getByTestId(`pin-pad-key-${d}`));
    }
    await user.click(screen.getByTestId('pin-pad-enter'));
    await waitFor(() => expect(screen.getByTestId('takeover-prompt')).toBeInTheDocument());
    expect(screen.getByTestId('takeover-prompt').textContent).not.toMatch(/Manager/);
    expect(screen.getByTestId('takeover-prompt').textContent).not.toMatch(/Admin/);
  });
});

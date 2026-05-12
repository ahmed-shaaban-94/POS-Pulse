import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';

import { StuckShiftSurface } from '../../../../../src/renderer/ui/operator/ForcedCloseSurface.js';
import type {
  OperatorBridgeAPI,
  ListStuckShiftsResponse,
} from '../../../../../src/shared/bridge-api.js';

/**
 * 004-operator-session T090 — StuckShiftSurface orchestration tests.
 *
 * Verifies:
 *  - Loading state rendered while fetching.
 *  - Empty state shown when no stuck shifts.
 *  - Error state shown with retry when backend fails.
 *  - Card list rendered for stuck shifts; card-stack (div), no table.
 *  - null display_name falls back to "Cashier ···".
 *  - duration_minutes formatting: < 1 → "< 1 min"; < 60 → "X min"; ≥ 60 → "X h Y min".
 *  - Clicking a card opens the forced-close dialog.
 *  - Submitting form calls forceCloseShift with correct args.
 *  - On forced_closed: dialog closes and card removed from list.
 *  - On state_invalid: error message shown and list refetched.
 *  - FR-024 blind-close: no financial fields in DOM.
 *  - FR-013 minimum-disclosure: no identity/credential fields in DOM.
 */

const SAMPLE_SHIFTS = [
  {
    shift_id: 'shift-111',
    cashier_display_name: 'Nour Al-Hassan',
    terminal_label: 'Terminal 3 — Pharmacy',
    opened_at: '2026-05-12T08:30:00.000Z',
    duration_minutes: 47,
  },
  {
    shift_id: 'shift-222',
    cashier_display_name: 'Ali Saad',
    terminal_label: 'Terminal 1',
    opened_at: '2026-05-12T07:00:00.000Z',
    duration_minutes: 90,
  },
];

function makeOperator(
  listResult: ListStuckShiftsResponse,
  forceResult: Awaited<ReturnType<OperatorBridgeAPI['forceCloseShift']>> = {
    kind: 'forced_closed',
    audit_event_id: 'evt-1',
  },
): Pick<OperatorBridgeAPI, 'listStuckShifts' | 'forceCloseShift'> {
  return {
    listStuckShifts: vi.fn(() => Promise.resolve(listResult)),
    forceCloseShift: vi.fn(() => Promise.resolve(forceResult)),
  };
}

afterEach(() => {
  cleanup();
});

// ─── Loading state ────────────────────────────────────────────────────────────

describe('StuckShiftSurface — loading state', () => {
  it('renders a loading indicator while fetching', async () => {
    let resolve!: (r: ListStuckShiftsResponse) => void;
    const pending = new Promise<ListStuckShiftsResponse>((res) => {
      resolve = res;
    });
    const op = {
      listStuckShifts: vi.fn(() => pending),
      forceCloseShift: vi.fn(),
    } as unknown as Pick<OperatorBridgeAPI, 'listStuckShifts' | 'forceCloseShift'>;

    render(<StuckShiftSurface operator={op} />);
    expect(screen.getByTestId('stuck-shift-surface-loading')).toBeInTheDocument();

    resolve({ kind: 'stuck_shifts', shifts: [] });
  });
});

// ─── Empty state ──────────────────────────────────────────────────────────────

describe('StuckShiftSurface — empty state', () => {
  it('renders empty state when no stuck shifts', async () => {
    const op = makeOperator({ kind: 'stuck_shifts', shifts: [] });
    render(<StuckShiftSurface operator={op} />);

    await waitFor(() => {
      expect(screen.getByTestId('stuck-shift-surface-empty')).toBeInTheDocument();
    });
  });
});

// ─── Error state ──────────────────────────────────────────────────────────────

describe('StuckShiftSurface — error state', () => {
  it('renders error state on no_connection', async () => {
    const op = makeOperator({ kind: 'refused', category: 'no_connection' });
    render(<StuckShiftSurface operator={op} />);

    await waitFor(() => {
      expect(screen.getByTestId('stuck-shift-surface-error')).toBeInTheDocument();
    });
  });

  it('renders error state on refused/invalid_input', async () => {
    const op = makeOperator({ kind: 'refused', category: 'invalid_input' });
    render(<StuckShiftSurface operator={op} />);

    await waitFor(() => {
      expect(screen.getByTestId('stuck-shift-surface-error')).toBeInTheDocument();
    });
  });

  it('retry button calls listStuckShifts again', async () => {
    const op = makeOperator({ kind: 'refused', category: 'no_connection' });
    render(<StuckShiftSurface operator={op} />);

    await waitFor(() => screen.getByTestId('stuck-shift-surface-error'));

    const retryBtn = screen.getByRole('button', { name: /retry/i });
    await userEvent.click(retryBtn);

    expect(op.listStuckShifts).toHaveBeenCalledTimes(2);
  });
});

// ─── Card list ────────────────────────────────────────────────────────────────

describe('StuckShiftSurface — card list rendering', () => {
  it('renders a card for each stuck shift', async () => {
    const op = makeOperator({ kind: 'stuck_shifts', shifts: SAMPLE_SHIFTS });
    render(<StuckShiftSurface operator={op} />);

    await waitFor(() => {
      expect(screen.getByText('Nour Al-Hassan')).toBeInTheDocument();
      expect(screen.getByText('Ali Saad')).toBeInTheDocument();
    });
  });

  it('renders terminal labels', async () => {
    const op = makeOperator({ kind: 'stuck_shifts', shifts: SAMPLE_SHIFTS });
    render(<StuckShiftSurface operator={op} />);

    await waitFor(() => {
      expect(screen.getByText('Terminal 3 — Pharmacy')).toBeInTheDocument();
    });
  });

  it('uses div card-stack layout, not a table', async () => {
    const { container } = render(
      <StuckShiftSurface
        operator={makeOperator({ kind: 'stuck_shifts', shifts: SAMPLE_SHIFTS })}
      />,
    );

    await waitFor(() => screen.getByText('Nour Al-Hassan'));

    expect(container.querySelector('table')).toBeNull();
    expect(container.querySelector('thead')).toBeNull();
    expect(container.querySelector('tbody')).toBeNull();
    expect(container.querySelector('tr')).toBeNull();
  });
});

// ─── Display name fallback ────────────────────────────────────────────────────

describe('StuckShiftSurface — null display_name fallback', () => {
  it('renders "Cashier ···" when display_name is null', async () => {
    const shifts = [
      {
        shift_id: 'shift-null',
        cashier_display_name: null as unknown as string,
        terminal_label: 'T1',
        opened_at: '2026-05-12T08:00:00.000Z',
        duration_minutes: 5,
      },
    ];
    const op = makeOperator({ kind: 'stuck_shifts', shifts });
    render(<StuckShiftSurface operator={op} />);

    await waitFor(() => {
      expect(screen.getByText('Cashier ···')).toBeInTheDocument();
    });
  });

  it('renders "Cashier ···" when display_name is empty string', async () => {
    const shifts = [
      {
        shift_id: 'shift-empty',
        cashier_display_name: '',
        terminal_label: 'T1',
        opened_at: '2026-05-12T08:00:00.000Z',
        duration_minutes: 5,
      },
    ];
    const op = makeOperator({ kind: 'stuck_shifts', shifts });
    render(<StuckShiftSurface operator={op} />);

    await waitFor(() => {
      expect(screen.getByText('Cashier ···')).toBeInTheDocument();
    });
  });
});

// ─── Duration formatting ──────────────────────────────────────────────────────

describe('StuckShiftSurface — duration formatting', () => {
  async function renderWithDuration(duration_minutes: number): Promise<void> {
    const shifts = [
      {
        shift_id: 'shift-dur',
        cashier_display_name: 'Test',
        terminal_label: 'T1',
        opened_at: '2026-05-12T08:00:00.000Z',
        duration_minutes,
      },
    ];
    render(<StuckShiftSurface operator={makeOperator({ kind: 'stuck_shifts', shifts })} />);
    await waitFor(() => screen.getByText('Test'));
  }

  it('formats duration < 1 as "< 1 min"', async () => {
    await renderWithDuration(0);
    expect(screen.getByText(/< 1 min/)).toBeInTheDocument();
    cleanup();
  });

  it('formats duration 47 as "47 min"', async () => {
    await renderWithDuration(47);
    expect(screen.getByText(/47 min/)).toBeInTheDocument();
    cleanup();
  });

  it('formats duration 60 as "1 h 0 min"', async () => {
    await renderWithDuration(60);
    expect(screen.getByText(/1 h 0 min/)).toBeInTheDocument();
    cleanup();
  });

  it('formats duration 90 as "1 h 30 min"', async () => {
    await renderWithDuration(90);
    expect(screen.getByText(/1 h 30 min/)).toBeInTheDocument();
    cleanup();
  });

  it('formats duration 125 as "2 h 5 min"', async () => {
    await renderWithDuration(125);
    expect(screen.getByText(/2 h 5 min/)).toBeInTheDocument();
    cleanup();
  });
});

// ─── Dialog flow ──────────────────────────────────────────────────────────────

describe('StuckShiftSurface — dialog flow', () => {
  it('clicking a card opens the forced-close dialog', async () => {
    const op = makeOperator({ kind: 'stuck_shifts', shifts: [SAMPLE_SHIFTS[0]!] });
    render(<StuckShiftSurface operator={op} />);

    await waitFor(() => screen.getByText('Nour Al-Hassan'));

    const card = screen.getByTestId('stuck-shift-card-shift-111');
    await userEvent.click(card);

    expect(screen.getByTestId('forced-close-form')).toBeInTheDocument();
  });

  it('dialog cancel button closes dialog without calling forceCloseShift', async () => {
    const op = makeOperator({ kind: 'stuck_shifts', shifts: [SAMPLE_SHIFTS[0]!] });
    render(<StuckShiftSurface operator={op} />);

    await waitFor(() => screen.getByText('Nour Al-Hassan'));

    await userEvent.click(screen.getByTestId('stuck-shift-card-shift-111'));
    expect(screen.getByTestId('forced-close-form')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));

    expect(screen.queryByTestId('forced-close-form')).toBeNull();
    expect(op.forceCloseShift).not.toHaveBeenCalled();
  });

  it('submitting form calls forceCloseShift with shift_id and reason', async () => {
    const op = makeOperator({ kind: 'stuck_shifts', shifts: [SAMPLE_SHIFTS[0]!] });
    render(<StuckShiftSurface operator={op} />);

    await waitFor(() => screen.getByText('Nour Al-Hassan'));

    await userEvent.click(screen.getByTestId('stuck-shift-card-shift-111'));

    // Select a reason
    const radioInput = screen.getByRole('radio', { name: /takeover_supersession/i });
    await userEvent.click(radioInput);

    // Submit
    await userEvent.click(screen.getByRole('button', { name: /confirm forced close/i }));

    await waitFor(() => {
      expect(op.forceCloseShift).toHaveBeenCalledOnce();
    });

    const call = vi.mocked(op.forceCloseShift).mock.calls[0]![0];
    expect(call.shift_id).toBe('shift-111');
    expect(call.reason).toBe('takeover_supersession');
    expect(call.event_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it('on forced_closed: dialog closes and card removed from list', async () => {
    const op = makeOperator({ kind: 'stuck_shifts', shifts: SAMPLE_SHIFTS });
    render(<StuckShiftSurface operator={op} />);

    await waitFor(() => screen.getByText('Nour Al-Hassan'));

    await userEvent.click(screen.getByTestId('stuck-shift-card-shift-111'));
    await userEvent.click(screen.getByRole('radio', { name: /cashier_no_show/i }));
    await userEvent.click(screen.getByRole('button', { name: /confirm forced close/i }));

    await waitFor(() => {
      // Dialog gone
      expect(screen.queryByTestId('forced-close-form')).toBeNull();
      // Card for shift-111 removed, shift-222 still present
      expect(screen.queryByTestId('stuck-shift-card-shift-111')).toBeNull();
      expect(screen.getByTestId('stuck-shift-card-shift-222')).toBeInTheDocument();
    });
  });

  it('on state_invalid refusal: shows error message and refetches', async () => {
    const op = makeOperator(
      { kind: 'stuck_shifts', shifts: [SAMPLE_SHIFTS[0]!] },
      { kind: 'refused', category: 'state_invalid' },
    );
    render(<StuckShiftSurface operator={op} />);

    await waitFor(() => screen.getByText('Nour Al-Hassan'));

    await userEvent.click(screen.getByTestId('stuck-shift-card-shift-111'));
    await userEvent.click(screen.getByRole('radio', { name: /takeover_supersession/i }));
    await userEvent.click(screen.getByRole('button', { name: /confirm forced close/i }));

    await waitFor(() => {
      expect(screen.getByTestId('stuck-shift-submit-error')).toBeInTheDocument();
    });
    // Refetch should have been called (initial + refetch = 2)
    expect(op.listStuckShifts).toHaveBeenCalledTimes(2);
  });
});

// ─── FR-024 blind-close discipline ───────────────────────────────────────────

describe('StuckShiftSurface — FR-024 blind-close (no financial fields)', () => {
  const FINANCIAL_FORBIDDEN = [
    /drawer/i,
    /declared/i,
    /variance/i,
    /shortage/i,
    /overage/i,
    /change fund/i,
    /cash in/i,
    /cash out/i,
    /expected total/i,
    /float/i,
    /balance/i,
    /revenue/i,
    /sales/i,
    /reconcil/i,
  ];

  FINANCIAL_FORBIDDEN.forEach((pattern) => {
    it(`does not render financial field matching ${String(pattern)}`, async () => {
      const op = makeOperator({ kind: 'stuck_shifts', shifts: SAMPLE_SHIFTS });
      const { container } = render(<StuckShiftSurface operator={op} />);
      await waitFor(() => screen.getByText('Nour Al-Hassan'));
      expect(container.textContent).not.toMatch(pattern);
    });
  });
});

// ─── FR-013 minimum-disclosure ────────────────────────────────────────────────

describe('StuckShiftSurface — FR-013 minimum-disclosure (no identity fields)', () => {
  const IDENTITY_FORBIDDEN = [
    /user_[0-9a-f-]{8,}/i,
    /usr_[0-9a-z]{10,}/i,
    /dev_[0-9a-z]{10,}/i,
    /device_id/i,
    /device_token/i,
    /tenant_id/i,
    /branch_id/i,
    /terminal_id/i,
    /@[a-z0-9.-]+\.[a-z]{2,}/i,
    /credential/i,
    /clerk/i,
  ];

  IDENTITY_FORBIDDEN.forEach((pattern) => {
    it(`does not render identity field matching ${String(pattern)}`, async () => {
      const op = makeOperator({ kind: 'stuck_shifts', shifts: SAMPLE_SHIFTS });
      const { container } = render(<StuckShiftSurface operator={op} />);
      await waitFor(() => screen.getByText('Nour Al-Hassan'));
      expect(container.textContent).not.toMatch(pattern);
    });
  });
});

// ─── maxLength on annotation ──────────────────────────────────────────────────

describe('ForcedCloseForm — annotation maxLength', () => {
  it('textarea has maxLength of 500', async () => {
    const op = makeOperator({ kind: 'stuck_shifts', shifts: [SAMPLE_SHIFTS[0]!] });
    render(<StuckShiftSurface operator={op} />);

    await waitFor(() => screen.getByText('Nour Al-Hassan'));

    await userEvent.click(screen.getByTestId('stuck-shift-card-shift-111'));

    const textarea = screen.getByRole('textbox', { name: /annotation/i });
    expect(textarea).toHaveAttribute('maxLength', '500');
  });
});

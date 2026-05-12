import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';

import { ForcedCloseForm } from '../../../../../src/renderer/ui/operator/ForcedCloseSurface.js';
import {
  FORCED_CLOSE_REASONS,
  type ForcedCloseReason,
} from '../../../../../src/shared/audit/payload-schemas.js';

/**
 * 004-operator-session T084 — ForcedCloseForm reason picker tests.
 *
 * Verifies:
 *   - Submit is disabled until a reason radio is selected.
 *   - Exactly the five enumerated FORCED_CLOSE_REASONS values are present.
 *   - No reason outside the enum is rendered.
 *   - Selecting each reason enables submit.
 *   - Free-text annotation is captured in payload.annotation.
 *   - payload.forced_close_reason contains only the ForcedCloseReason value,
 *     never the annotation text.
 *   - No financial fields are present in the submit payload.
 *   - No financial or PII fields are rendered.
 */

afterEach(() => {
  cleanup();
});

function setup(onSubmit?: (payload: { forced_close_reason: ForcedCloseReason; annotation?: string }) => void) {
  const handler = onSubmit ?? vi.fn();
  render(<ForcedCloseForm onSubmit={handler} />);
  return { onSubmit: handler };
}

describe('ForcedCloseForm — initial state', () => {
  it('submit button is disabled before any reason is selected', () => {
    setup();
    const btn = screen.getByRole('button', { name: /confirm|force.?close|submit/i });
    expect(btn).toBeDisabled();
  });

  it('renders exactly five reason radios', () => {
    setup();
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(5);
  });

  it('renders all five FORCED_CLOSE_REASONS values', () => {
    setup();
    for (const reason of FORCED_CLOSE_REASONS) {
      expect(screen.getByDisplayValue(reason)).toBeInTheDocument();
    }
  });

  it('no radio is checked initially', () => {
    setup();
    const radios = screen.getAllByRole('radio');
    for (const radio of radios) {
      expect(radio).not.toBeChecked();
    }
  });
});

describe('ForcedCloseForm — reason selection enables submit', () => {
  for (const reason of FORCED_CLOSE_REASONS) {
    it(`selecting "${reason}" enables submit`, async () => {
      const user = userEvent.setup();
      setup();
      await user.click(screen.getByDisplayValue(reason));
      const btn = screen.getByRole('button', { name: /confirm|force.?close|submit/i });
      expect(btn).toBeEnabled();
    });
  }
});

describe('ForcedCloseForm — submit payload correctness', () => {
  it('payload.forced_close_reason equals the selected reason', async () => {
    const user = userEvent.setup();
    const { onSubmit } = setup(vi.fn());
    await user.click(screen.getByDisplayValue('cashier_no_show'));
    await user.click(screen.getByRole('button', { name: /confirm|force.?close|submit/i }));
    expect(onSubmit).toHaveBeenCalledOnce();
    const payload = (onSubmit as ReturnType<typeof vi.fn>).mock.calls[0][0] as {
      forced_close_reason: ForcedCloseReason;
      annotation?: string;
    };
    expect(payload.forced_close_reason).toBe('cashier_no_show');
  });

  it('annotation text appears in payload.annotation, not in forced_close_reason', async () => {
    const user = userEvent.setup();
    const { onSubmit } = setup(vi.fn());
    await user.click(screen.getByDisplayValue('other'));
    const annotationInput = screen.getByRole('textbox');
    await user.type(annotationInput, 'Cashier left early without notice');
    await user.click(screen.getByRole('button', { name: /confirm|force.?close|submit/i }));
    expect(onSubmit).toHaveBeenCalledOnce();
    const payload = (onSubmit as ReturnType<typeof vi.fn>).mock.calls[0][0] as {
      forced_close_reason: ForcedCloseReason;
      annotation?: string;
    };
    expect(payload.forced_close_reason).toBe('other');
    expect(payload.annotation).toBe('Cashier left early without notice');
    expect(payload.forced_close_reason).not.toContain('Cashier left early');
  });

  it('payload without annotation omits annotation key or sets it undefined', async () => {
    const user = userEvent.setup();
    const { onSubmit } = setup(vi.fn());
    await user.click(screen.getByDisplayValue('terminal_failure'));
    await user.click(screen.getByRole('button', { name: /confirm|force.?close|submit/i }));
    const payload = (onSubmit as ReturnType<typeof vi.fn>).mock.calls[0][0] as {
      forced_close_reason: ForcedCloseReason;
      annotation?: string;
    };
    expect(payload.forced_close_reason).toBe('terminal_failure');
    expect(payload.annotation == null || payload.annotation === '').toBe(true);
  });

  it('payload does not include any financial or PII fields', async () => {
    const user = userEvent.setup();
    const { onSubmit } = setup(vi.fn());
    await user.click(screen.getByDisplayValue('cashier_illness'));
    await user.click(screen.getByRole('button', { name: /confirm|force.?close|submit/i }));
    const payload = (onSubmit as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<string, unknown>;
    const forbidden = [
      'drawer_count', 'expected_total', 'variance', 'shortage', 'overage',
      'cash_in', 'cash_out', 'declared_count', 'balance', 'shift_total',
      'cashier_id', 'operator_id', 'user_id', 'device_id', 'tenant_id',
      'branch_id', 'terminal_id', 'email', 'pin',
    ];
    for (const key of forbidden) {
      expect(Object.prototype.hasOwnProperty.call(payload, key)).toBe(false);
    }
  });
});

describe('ForcedCloseForm — forbidden rendered content', () => {
  const FINANCIAL_FORBIDDEN = [
    /drawer/i,
    /expected.?total/i,
    /variance/i,
    /shortage/i,
    /overage/i,
    /cash.?count/i,
    /reconcil/i,
    /balance/i,
  ];

  FINANCIAL_FORBIDDEN.forEach((pattern) => {
    it(`does not render financial label matching ${String(pattern)}`, () => {
      const { container } = render(<ForcedCloseForm onSubmit={vi.fn()} />);
      expect(container.textContent).not.toMatch(pattern);
    });
  });
});

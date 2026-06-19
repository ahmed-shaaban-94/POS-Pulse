/**
 * Defect B — CashEntry must NOT allow applying a cash line when the balance is
 * already fully tendered (remaining == 0).
 *
 * Live-observed: clicking "Confirm cash payment" repeatedly on a settled
 * attempt piled 19 all-change tender lines (each amount==change, net 0). The
 * bridged-mode gate was `isPositive` only — any amount > 0 enabled confirm,
 * regardless of whether anything was still owed. Once remaining hits 0 the
 * cashier must move to "Confirm payment" (settle), not apply more cash.
 *
 * Fix preserves split-tender: a partial apply is allowed WHILE remaining > 0.
 */

import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, it, expect, vi } from 'vitest';

import { CashEntry } from '../CashEntry.js';
import type { TenderApplyRequest, TenderApplyResponse } from '../../../../shared/bridge-api.js';

afterEach(cleanup);

const okApply = vi.fn<(req: TenderApplyRequest) => Promise<TenderApplyResponse>>(
  async () => ({ kind: 'ok', tender_line_id: 'tl', applied_at: '2026-06-19T09:00:00.000Z' }),
);

/** Bridged mode (tenderApply + paymentAttemptId provided). */
function renderBridged(remainingBalanceMinor: number) {
  render(
    <CashEntry
      remainingBalanceMinor={remainingBalanceMinor}
      paymentAttemptId="pa-1"
      tenderApply={okApply}
      onApplied={vi.fn()}
    />,
  );
  return screen.getByTestId('cash-entry-confirm') as HTMLButtonElement;
}

describe('CashEntry — no over-apply once the balance is fully tendered (Defect B)', () => {
  it('DISABLES confirm in bridged mode when remaining is already 0, even with a positive amount entered', () => {
    const confirm = renderBridged(0);
    fireEvent.change(screen.getByTestId('cash-entry-amount-input'), { target: { value: '12.50' } });
    // Nothing is owed — applying another cash line would only pile change. Block it.
    expect(confirm).toBeDisabled();
  });

  it('still ENABLES confirm in bridged mode when a balance is owed (split-tender partial apply allowed)', () => {
    const confirm = renderBridged(1250);
    fireEvent.change(screen.getByTestId('cash-entry-amount-input'), { target: { value: '5.00' } });
    // 5.00 partial against a 12.50 balance → allowed (the surface re-prompts for the rest).
    expect(confirm).toBeEnabled();
  });

  it('ENABLES confirm for an exact/over tender while a balance is still owed', () => {
    const confirm = renderBridged(1250);
    fireEvent.change(screen.getByTestId('cash-entry-amount-input'), { target: { value: '12.50' } });
    expect(confirm).toBeEnabled();
  });
});

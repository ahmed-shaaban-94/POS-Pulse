import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import { RosterList } from '../RosterList.js';

/**
 * 004-operator-session T018 — RosterList renders branch cashiers
 * only (FR-006 / FR-031 — no email, no phone, no audit history).
 *
 * S1 leaves this surface inert; the test still verifies the active
 * code path that lands in S4 so a future contributor cannot regress
 * the redaction posture without flipping a test.
 */

afterEach(() => {
  cleanup();
});

describe('RosterList (T018)', () => {
  it('renders the inert message when inert=true', () => {
    render(<RosterList cashiers={[]} inert />);
    const list = screen.getByTestId('roster-list');
    expect(list).toHaveAttribute('data-state', 'inert');
    expect(list).toHaveTextContent(/manager or admin/i);
  });

  it('renders the inert message when cashiers is empty (S1 default)', () => {
    render(<RosterList cashiers={[]} />);
    expect(screen.getByTestId('roster-list')).toHaveAttribute('data-state', 'inert');
  });

  it('renders cashier display name + role only (no PII fields)', () => {
    const cashiers = [
      { id: 'op-1', display_name: 'Sara K.', role: 'cashier' as const },
      { id: 'op-2', display_name: 'Omar A.', role: 'cashier' as const },
    ];
    render(<RosterList cashiers={cashiers} />);
    const list = screen.getByTestId('roster-list');
    expect(list).toHaveAttribute('data-state', 'active');
    expect(screen.getByText('Sara K.')).toBeInTheDocument();
    expect(screen.getByText('Omar A.')).toBeInTheDocument();
    // No email, no phone, no audit history surface in the rendered DOM.
    const html = list.innerHTML;
    expect(html).not.toMatch(/@/); // no email
    expect(html).not.toMatch(/phone/i);
    expect(html).not.toMatch(/audit/i);
  });

  it('renders the business-name role string for each cashier (FR-002)', () => {
    render(<RosterList cashiers={[{ id: 'op-1', display_name: 'Sara', role: 'cashier' }]} />);
    expect(screen.getByText('Cashier')).toBeInTheDocument();
  });
});

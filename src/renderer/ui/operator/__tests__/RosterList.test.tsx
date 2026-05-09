import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';

import { RosterList, type RosterEntry } from '../RosterList.js';

/**
 * 004-operator-session T030 / T075 — RosterList component tests.
 *
 * Verifies:
 *   - Inert state renders empty-state message.
 *   - Empty cashiers array renders inert state.
 *   - Active state renders all cashier entries.
 *   - With onSelect: cashier buttons are rendered and call onSelect on click.
 *   - Without onSelect: spans are rendered (no button).
 *   - selectedId: matching cashier gets aria-selected + CSS class.
 *   - selectedId: non-matching cashier does NOT get selected class.
 */

const CASHIERS: RosterEntry[] = [
  { id: 'c1', display_name: 'Alice Smith', role: 'cashier' },
  { id: 'c2', display_name: 'Bob Jones', role: 'cashier' },
];

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe('RosterList — inert state', () => {
  it('renders inert when inert prop is true', () => {
    render(<RosterList cashiers={CASHIERS} inert={true} />);
    expect(screen.getByTestId('roster-list')).toHaveAttribute('data-state', 'inert');
  });

  it('renders inert when cashiers array is empty', () => {
    render(<RosterList cashiers={[]} />);
    expect(screen.getByTestId('roster-list')).toHaveAttribute('data-state', 'inert');
  });

  it('shows the empty-state message when inert', () => {
    render(<RosterList cashiers={[]} />);
    expect(screen.getByText(/Cashier sign-in is not yet available/i)).toBeInTheDocument();
  });
});

describe('RosterList — active state', () => {
  it('renders data-state active when cashiers are provided', () => {
    render(<RosterList cashiers={CASHIERS} />);
    expect(screen.getByTestId('roster-list')).toHaveAttribute('data-state', 'active');
  });

  it('renders one item per cashier', () => {
    render(<RosterList cashiers={CASHIERS} />);
    expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    expect(screen.getByText('Bob Jones')).toBeInTheDocument();
  });
});

describe('RosterList — with onSelect', () => {
  it('renders a button for each cashier', () => {
    render(<RosterList cashiers={CASHIERS} onSelect={vi.fn()} />);
    expect(screen.getByTestId('roster-item-c1')).toBeInTheDocument();
    expect(screen.getByTestId('roster-item-c2')).toBeInTheDocument();
  });

  it('clicking a cashier button calls onSelect with that cashier', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<RosterList cashiers={CASHIERS} onSelect={onSelect} />);
    await user.click(screen.getByTestId('roster-item-c1'));
    expect(onSelect).toHaveBeenCalledWith(CASHIERS[0]);
  });

  it('clicking a second cashier calls onSelect with the correct entry', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<RosterList cashiers={CASHIERS} onSelect={onSelect} />);
    await user.click(screen.getByTestId('roster-item-c2'));
    expect(onSelect).toHaveBeenCalledWith(CASHIERS[1]);
  });
});

describe('RosterList — without onSelect', () => {
  it('does not render buttons when onSelect is omitted', () => {
    render(<RosterList cashiers={CASHIERS} />);
    expect(screen.queryByTestId('roster-item-c1')).not.toBeInTheDocument();
  });

  it('still renders cashier names as text', () => {
    render(<RosterList cashiers={CASHIERS} />);
    expect(screen.getByText('Alice Smith')).toBeInTheDocument();
  });
});

describe('RosterList — selectedId', () => {
  it('selected cashier has aria-selected=true', () => {
    render(<RosterList cashiers={CASHIERS} onSelect={vi.fn()} selectedId="c1" />);
    const item = screen.getByTestId('roster-item-c1').closest('[role="option"]');
    expect(item).toHaveAttribute('aria-selected', 'true');
  });

  it('non-selected cashier has aria-selected=false', () => {
    render(<RosterList cashiers={CASHIERS} onSelect={vi.fn()} selectedId="c1" />);
    const item = screen.getByTestId('roster-item-c2').closest('[role="option"]');
    expect(item).toHaveAttribute('aria-selected', 'false');
  });

  it('selected cashier li gets the --selected CSS class', () => {
    render(<RosterList cashiers={CASHIERS} onSelect={vi.fn()} selectedId="c2" />);
    const item = screen.getByTestId('roster-item-c2').closest('li');
    expect(item).toHaveClass('roster-list__item--selected');
  });

  it('unselected cashier li does NOT get the --selected CSS class', () => {
    render(<RosterList cashiers={CASHIERS} onSelect={vi.fn()} selectedId="c2" />);
    const item = screen.getByTestId('roster-item-c1').closest('li');
    expect(item).not.toHaveClass('roster-list__item--selected');
  });
});

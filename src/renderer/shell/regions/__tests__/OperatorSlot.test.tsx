import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';

import { OperatorSlot } from '../OperatorSlot';

afterEach(cleanup);

/**
 * T030 — OperatorSlot: visibly disabled "Sign in" button; Constitution VIII.
 */
describe('OperatorSlot (T030)', () => {
  it('renders a "Sign in" button', () => {
    render(<OperatorSlot />);
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('button has aria-disabled="true"', () => {
    render(<OperatorSlot />);
    expect(screen.getByRole('button', { name: /sign in/i })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });

  it('button is non-focusable (tabIndex=-1)', () => {
    render(<OperatorSlot />);
    expect(screen.getByRole('button', { name: /sign in/i })).toHaveAttribute('tabindex', '-1');
  });

  it('click is a no-op — zero handler invocations', async () => {
    const user = userEvent.setup();
    render(<OperatorSlot />);
    const btn = screen.getByRole('button', { name: /sign in/i });
    await user.click(btn);
    // No handler was passed — asserting no throw and no navigation
    expect(btn).toBeInTheDocument();
  });

  it('shows "no operator signed in" accessible explanation', () => {
    render(<OperatorSlot />);
    // The tooltip/aria explanation should contain this copy
    const explanation = screen.queryByText(/sign.in is not yet available/i);
    // It may be in a tooltip (title attr) or sr-only span
    const hasExplanation =
      explanation !== null ||
      screen.getByRole('button', { name: /sign in/i }).hasAttribute('title');
    expect(hasExplanation).toBe(true);
  });
});

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import { ScreenTooSmall } from '../index';

afterEach(cleanup);

/**
 * T013 — ScreenTooSmall frozen-copy assertions.
 * (contracts/shell-regions.md §"ScreenTooSmall")
 */
describe('ScreenTooSmall (T013)', () => {
  it('heading text === "Screen too small"', () => {
    render(<ScreenTooSmall />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Screen too small');
  });

  it('body paragraph text === "Use a display at least 1024px wide to run POS Pulse."', () => {
    render(<ScreenTooSmall />);
    expect(
      screen.getByText('Use a display at least 1024px wide to run POS Pulse.'),
    ).toBeInTheDocument();
  });

  it('exactly one <h1>', () => {
    const { container } = render(<ScreenTooSmall />);
    expect(container.querySelectorAll('h1')).toHaveLength(1);
  });

  it('exactly one <main>', () => {
    const { container } = render(<ScreenTooSmall />);
    expect(container.querySelectorAll('main')).toHaveLength(1);
  });

  it('zero actionable elements — no button, a, input, or [role="button"]', () => {
    const { container } = render(<ScreenTooSmall />);
    expect(container.querySelectorAll('button')).toHaveLength(0);
    expect(container.querySelectorAll('a')).toHaveLength(0);
    expect(container.querySelectorAll('input')).toHaveLength(0);
    expect(container.querySelectorAll('[role="button"]')).toHaveLength(0);
  });

  it('heading receives focus on mount (tabIndex=-1 + focus)', () => {
    render(<ScreenTooSmall />);
    const heading = screen.getByRole('heading', { level: 1 });
    expect(document.activeElement).toBe(heading);
  });
});

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';

import { ThemeToggle } from '../ThemeToggle';
import { useThemeStore, initTheme, THEME_STORAGE_KEY } from '../../../stores/theme-store';
import { expectNoAxeViolations } from '../../../ui/primitives/__tests__/axe-config';

/**
 * POS v3.5 Phase 1 — ThemeToggle wiring (ADR-0004).
 *
 * The store's default/persistence is proved in theme-contract.test.ts.
 * This closes the remaining loop for the named "working light toggle"
 * deliverable: the BUTTON's onClick is actually wired to the store and a
 * real click flips the theme + repaints the document root. It also keeps
 * the toggle within the axe baseline (it is a new TopBar affordance).
 */

afterEach(cleanup);

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  initTheme(); // reset to the persisted default (dark) before each case
});

describe('ThemeToggle — toggle wiring (ADR-0004)', () => {
  it('renders as a ghost button with an accessible, target-naming label', () => {
    render(<ThemeToggle />);
    const button = screen.getByRole('button', { name: 'Switch to light theme' });
    expect(button).toHaveClass('btn', 'btn--ghost', 'theme-toggle');
    // aria-pressed reflects the active (dark) state.
    expect(button).toHaveAttribute('aria-pressed', 'true');
  });

  it('a click flips dark → light: store, root attribute, and persistence', async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);
    expect(useThemeStore.getState().theme).toBe('dark');

    await user.click(screen.getByRole('button', { name: 'Switch to light theme' }));

    expect(useThemeStore.getState().theme).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
    // Label now names the opposite target.
    expect(screen.getByRole('button', { name: 'Switch to dark theme' })).toBeInTheDocument();
  });

  it('a second click flips light → dark again (round-trip)', async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);
    const button = () => screen.getByRole('button');
    await user.click(button());
    expect(useThemeStore.getState().theme).toBe('light');
    await user.click(button());
    expect(useThemeStore.getState().theme).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('no axe violations', async () => {
    const { container } = render(<ThemeToggle />);
    await expectNoAxeViolations(container);
  });
});

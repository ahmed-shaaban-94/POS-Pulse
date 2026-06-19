/**
 * POS v3.5 Phase 4 — <SettingsSkeleton>.
 *
 * The v3.5 Settings surface as a VISUAL skeleton. Exactly one control is
 * functional — the existing Phase-1 theme toggle. Terminal label, receipt
 * header, and connection simulation are presentational-only "coming soon"
 * rows: labelled, visibly disabled, and wired to NOTHING (no persistence, no
 * receipt change, no fake connection state).
 */

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import { SettingsSkeleton } from '../SettingsSkeleton';
import { useThemeStore, DEFAULT_THEME } from '../../../stores/theme-store';

afterEach(() => {
  cleanup();
  useThemeStore.setState({ theme: DEFAULT_THEME });
});

describe('SettingsSkeleton — functional theme control', () => {
  it('renders the functional theme toggle (the one live control)', () => {
    render(<SettingsSkeleton />);
    expect(
      screen.getByRole('button', { name: /switch to (light|dark) theme/i }),
    ).toBeInTheDocument();
  });

  it('the theme section is marked as a functional section', () => {
    render(<SettingsSkeleton />);
    expect(screen.getByTestId('settings-section-theme')).toHaveAttribute('data-functional', 'true');
  });
});

describe('SettingsSkeleton — coming-soon (presentational-only) rows', () => {
  const comingSoon = [
    ['terminal-label', /terminal label/i],
    ['receipt-header', /receipt header/i],
    ['connection-sim', /connection simulation/i],
  ] as const;

  it.each(comingSoon)('renders a disabled coming-soon row for %s', (key, labelRe) => {
    render(<SettingsSkeleton />);
    const row = screen.getByTestId(`settings-row-${key}`);
    expect(row).toBeInTheDocument();
    expect(row).toHaveTextContent(labelRe);
    expect(row).toHaveAttribute('data-functional', 'false');
    expect(row).toHaveTextContent(/coming soon/i);
  });

  it('coming-soon rows expose no enabled, persistence-capable input', () => {
    render(<SettingsSkeleton />);
    for (const [key] of comingSoon) {
      const row = screen.getByTestId(`settings-row-${key}`);
      // Any control inside a coming-soon row must be disabled (no live input
      // → nothing can persist or change a receipt / connection state).
      const controls = row.querySelectorAll('input, select, textarea, button');
      controls.forEach((c) => expect(c).toBeDisabled());
    }
  });
});

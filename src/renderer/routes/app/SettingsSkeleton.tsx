import type { JSX } from 'react';

import { ThemeToggle } from '../../shell/regions/ThemeToggle';

/**
 * POS v3.5 Phase 4 — Settings surface (guarded full skeleton).
 *
 * The v3.5 Settings layout rendered as a VISUAL skeleton. Exactly one control
 * is functional — the existing Phase-1 theme toggle (reused, not rebuilt).
 * Terminal label, receipt header, and connection simulation appear as the v3.5
 * design intends but are presentational-only "coming soon" rows: labelled,
 * disabled, and wired to nothing.
 *
 * HARD RULES (owner directive, Phase 4):
 *   - Persist NO new setting except the existing theme preference.
 *   - Do NOT change printed receipt output.
 *   - Do NOT create fake connection state.
 *   - Honest "coming soon" labels where the backing behavior/contract is absent.
 */

interface ComingSoonRow {
  key: string;
  label: string;
  description: string;
}

const COMING_SOON_ROWS: readonly ComingSoonRow[] = [
  {
    key: 'terminal-label',
    label: 'Terminal label',
    description: 'Name this terminal for receipts and reports.',
  },
  {
    key: 'receipt-header',
    label: 'Receipt header',
    description: 'Customise the header printed on receipts.',
  },
  {
    key: 'connection-sim',
    label: 'Connection simulation',
    description: 'Exercise offline / degraded / syncing states.',
  },
];

export function SettingsSkeleton(): JSX.Element {
  return (
    <div className="settings-skeleton">
      <section
        className="settings-section settings-section--functional"
        data-testid="settings-section-theme"
        data-functional="true"
        aria-label="Theme"
      >
        <div className="settings-section__heading">
          <h2 className="settings-section__title">Theme</h2>
          <p className="settings-section__hint">
            Dark is the default; switch to light at any time. Your choice is remembered on this
            terminal.
          </p>
        </div>
        <ThemeToggle />
      </section>

      {COMING_SOON_ROWS.map((row) => (
        <section
          key={row.key}
          className="settings-section settings-section--coming-soon"
          data-testid={`settings-row-${row.key}`}
          data-functional="false"
          aria-label={row.label}
        >
          <div className="settings-section__heading">
            <h2 className="settings-section__title">
              {row.label}
              <span className="settings-section__badge" data-testid={`settings-badge-${row.key}`}>
                Coming soon
              </span>
            </h2>
            <p className="settings-section__hint">{row.description}</p>
          </div>
          {/*
            Presentational-only: a disabled control communicates the future
            affordance without enabling any input. Nothing here persists, prints,
            or alters connection state.
          */}
          <button type="button" className="settings-section__control" disabled aria-disabled="true">
            Not yet available
          </button>
        </section>
      ))}
    </div>
  );
}

import type { JSX } from 'react';
import type { ConnectionState } from '../../ui/tokens/connection-state';
import { IdentityStrip } from './IdentityStrip';
import { ConnectionIndicator } from './ConnectionIndicator';
import { OperatorSlot } from './OperatorSlot';
import { ThemeToggle } from './ThemeToggle';
import { StatusBanner } from '../../ui/primitives/StatusBanner/StatusBanner';

interface TopBarProps {
  tenantId: string;
  branchId: string;
  terminalLabel: string;
  connectionState: ConnectionState;
}

/**
 * T045 (US4) — Non-online states surface a non-blocking StatusBanner.
 * Banner messages match the indicator labels (contracts/shell-regions.md
 * §"Connection-state visuals").
 *
 * All four states are covered; `online` is omitted from the rendered banner
 * via the `connectionState !== 'online'` guard, so it never reaches StatusBanner.
 */
const BANNER_MESSAGES: Record<Exclude<ConnectionState, 'online'>, string> = {
  degraded: 'Connection slow',
  offline: 'Offline',
  syncing: 'Syncing…',
};

/**
 * T049 [S3] — TopBar restyle.
 *
 * Left cluster: SmartDataPulse wordmark · branch · terminal chip.
 * Right cluster: ConnectionIndicator + OperatorSlot (sign out button
 * is part of OperatorSlot when a session is active).
 * StatusBanner renders below the bar for non-online states.
 *
 * The terminal chip uses .top-bar__terminal-chip which maps to
 * --color-surface-sunken bg + --font-family-mono in CSS.
 * Device token is never rendered.
 */
export function TopBar({
  tenantId,
  branchId,
  terminalLabel,
  connectionState,
}: TopBarProps): JSX.Element {
  return (
    <>
      <header role="banner" className="top-bar">
        <div className="top-bar__left">
          <span className="top-bar__wordmark" aria-label="SmartDataPulse">
            SmartDataPulse
          </span>
          <IdentityStrip tenantId={tenantId} branchId={branchId} terminalLabel={terminalLabel} />
        </div>
        <div className="top-bar__right">
          <ConnectionIndicator state={connectionState} />
          <ThemeToggle />
          <OperatorSlot />
        </div>
      </header>
      {connectionState !== 'online' && (
        <StatusBanner state={connectionState} message={BANNER_MESSAGES[connectionState]} />
      )}
    </>
  );
}

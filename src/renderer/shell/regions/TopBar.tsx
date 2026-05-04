import type { JSX } from 'react';
import type { ConnectionState } from '../../ui/tokens/connection-state';
import { IdentityStrip } from './IdentityStrip';
import { ConnectionIndicator } from './ConnectionIndicator';
import { OperatorSlot } from './OperatorSlot';
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

export function TopBar({
  tenantId,
  branchId,
  terminalLabel,
  connectionState,
}: TopBarProps): JSX.Element {
  return (
    <header role="banner" className="top-bar">
      <IdentityStrip tenantId={tenantId} branchId={branchId} terminalLabel={terminalLabel} />
      {connectionState !== 'online' && (
        <StatusBanner
          state={connectionState}
          message={BANNER_MESSAGES[connectionState]}
        />
      )}
      <ConnectionIndicator state={connectionState} />
      <OperatorSlot />
    </header>
  );
}

import type { JSX } from 'react';
import { Outlet } from 'react-router-dom';

import { TopBar } from './regions/TopBar';
import { NavRail } from './regions/NavRail';
import { ScreenTooSmall } from '../ui/states/ScreenTooSmall';
import { useViewportTier } from './viewport/useViewportTier';
import { useConnectionState } from './connection/useConnectionState';
import type { PairingStatus } from '../../shared/pairing-types';

interface AppShellProps {
  pairedStatus?: Extract<PairingStatus, { kind: 'paired' }>;
}

/**
 * T034 — AppShell: the persistent layout shell.
 *
 * Composes TopBar (banner), NavRail (navigation), and MainContent (main / Outlet).
 * At < 1024 px the NavRail is suppressed and ScreenTooSmall replaces MainContent.
 */
export function AppShell({ pairedStatus }: AppShellProps): JSX.Element {
  const tier = useViewportTier();
  const { state: connectionState } = useConnectionState();

  const tenantId = pairedStatus?.tenant_id ?? '';
  const branchId = pairedStatus?.branch_id ?? '';
  const terminalLabel = pairedStatus?.terminal_label ?? '';

  if (tier === 'too-small') {
    return (
      <div data-testid="app-shell">
        <TopBar
          tenantId={tenantId}
          branchId={branchId}
          terminalLabel={terminalLabel}
          connectionState={connectionState}
        />
        <ScreenTooSmall />
      </div>
    );
  }

  return (
    <div
      data-testid="app-shell"
      style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}
    >
      <TopBar
        tenantId={tenantId}
        branchId={branchId}
        terminalLabel={terminalLabel}
        connectionState={connectionState}
      />
      <div style={{ display: 'flex', flex: 1 }}>
        <NavRail />
        <main style={{ flex: 1, overflow: 'auto' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

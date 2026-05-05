import type { JSX } from 'react';
import { useEffect } from 'react';
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
 * T034/T045 — AppShell: the persistent layout shell.
 *
 * Composes TopBar (banner), NavRail (navigation), and MainContent (main / Outlet).
 * At < 1024 px the NavRail is suppressed and ScreenTooSmall replaces MainContent.
 *
 * T045 (US4): wires the ?conn= dev toggle to useConnectionState.
 * The wiring is gated by import.meta.env.DEV so it is tree-shaken from
 * production builds. useDevToggles is imported lazily inside the effect
 * for the same reason.
 */
export function AppShell({ pairedStatus }: AppShellProps): JSX.Element {
  const tier = useViewportTier();
  const { state: connectionState, setState: setConnectionState } = useConnectionState();

  // Dev-only: wire ?conn= URL param → useConnectionState.
  // The cast keeps TS happy while Vite tree-shakes the dev branch from production.
  useEffect(() => {
    const metaEnv = (import.meta as unknown as { env?: { DEV?: boolean } }).env;
    if (!metaEnv?.DEV) return;
    // Dynamically read the dev toggle to keep the module tree-shakeable.
    // useDevToggles reads window.location.search synchronously — no async.
    void import('./dev/useDevToggles').then(({ getDevToggles }) => {
      const { conn } = getDevToggles();
      setConnectionState(conn);
    });
    // Intentionally run only on mount; URL search params are static per page load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tenantId = pairedStatus?.tenant_id ?? '';
  const branchId = pairedStatus?.branch_id ?? '';
  const terminalLabel = pairedStatus?.terminal_label ?? '';

  if (tier === 'too-small') {
    return (
      <div className="app-shell" data-testid="app-shell">
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
    <div className="app-shell" data-testid="app-shell">
      <TopBar
        tenantId={tenantId}
        branchId={branchId}
        terminalLabel={terminalLabel}
        connectionState={connectionState}
      />
      <div className="app-shell__body">
        <NavRail />
        <main className="app-shell__content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

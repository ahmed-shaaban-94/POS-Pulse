import type { JSX } from 'react';
import type { ConnectionState } from '../../ui/tokens/connection-state';

interface ConnectionIndicatorProps {
  state: ConnectionState;
}

const LABELS: Record<ConnectionState, string> = {
  online: 'Online',
  degraded: 'Connection slow',
  offline: 'Offline',
  syncing: 'Syncing…',
};

/**
 * Color-intent token mapping per the contract table
 * (contracts/shell-regions.md §"Connection-state visuals"):
 *
 * | State    | Intent   | CSS token               |
 * |----------|----------|-------------------------|
 * | online   | success  | --color-success         |
 * | degraded | warning  | --color-warning         |
 * | offline  | danger   | --color-danger          |
 * | syncing  | neutral  | --color-neutral         |
 */
const INTENTS: Record<ConnectionState, 'success' | 'warning' | 'danger' | 'neutral'> = {
  online: 'success',
  degraded: 'warning',
  offline: 'danger',
  syncing: 'neutral',
};

/**
 * T045 — ConnectionIndicator (US4).
 *
 * Renders four distinct visual states driven by the useConnectionState zustand slice.
 * Visual-only — no side-effects on any state transition.
 *
 * syncing MUST NOT:
 * - trigger any sync queue / replay / background job
 * - trigger any backend / fetch call
 * - touch any persistence (localStorage, sessionStorage, better-sqlite3, the credential store)
 * - introduce any new IPC channel
 * - change the preload bridge surface
 * - contain any actual network synchronization logic
 * (contracts/shell-regions.md §"syncing — hard non-implementation list")
 */
export function ConnectionIndicator({ state }: ConnectionIndicatorProps): JSX.Element {
  const label = LABELS[state];
  const intent = INTENTS[state];

  return (
    <div
      role="status"
      aria-label={label}
      data-connection-state={state}
      data-intent={intent}
      className={`connection-indicator connection-indicator--${intent}`}
    >
      {label}
    </div>
  );
}

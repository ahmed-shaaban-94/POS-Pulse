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
 * Minimal ConnectionIndicator — visual-only.
 * No backend call, no IPC, no fetch, no persistence, no sync queue.
 * Full US4 behavior (cycling states via dev toggle) is deferred to PR #3.
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
  return (
    <div role="status" aria-label={LABELS[state]} data-connection-state={state}>
      {LABELS[state]}
    </div>
  );
}

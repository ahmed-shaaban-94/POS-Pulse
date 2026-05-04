import { create } from 'zustand';
import type { ConnectionState } from '../../ui/tokens/connection-state';

/**
 * T028 — Connection-state zustand slice.
 *
 * Four-state enum with a single setter. No side-effect listeners.
 * The `syncing` state is visual-only — no sync queue, no fetch,
 * no IPC, no persistence (contracts/shell-regions.md §"syncing hard
 * non-implementation list").
 */

interface ConnectionStateSlice {
  state: ConnectionState;
  setState: (next: ConnectionState) => void;
}

export const useConnectionStateStore = create<ConnectionStateSlice>()((set) => ({
  state: 'online',
  setState: (next) => {
    set({ state: next });
  },
}));

export function useConnectionState(): ConnectionStateSlice {
  return useConnectionStateStore();
}

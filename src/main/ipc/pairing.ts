import type { IpcMain } from 'electron';

import { PAIRING_IPC_CHANNELS } from '../../shared/pairing-types.js';
import type { PairingStore } from '../pairing/store.js';

/**
 * 002-terminal-pairing T013 — `pairing:*` IPC handlers.
 *
 * One registration entry-point per namespace. US1 wires only
 * `pairing:get-status`; the `pairing:submit` channel lands in US2 and is
 * deliberately NOT registered here yet (scope guard, asserted by
 * src/main/ipc/__tests__/pairing.test.ts).
 *
 * The store is INJECTED so unit tests don't have to construct a real
 * SecretStore + DB. Mirrors the Phase 9 `app:config` pattern.
 *
 * Security policy: the handler returns `PairingStatus` unchanged. That
 * type carries no token field by design (data-model.md §
 * "Status derivation logic" + pairing-types.ts:21-35) — the renderer
 * therefore never sees a device_token even on the success branch.
 */
export function registerPairingHandlers(ipcMain: IpcMain, store: PairingStore): void {
  ipcMain.handle(PAIRING_IPC_CHANNELS.GET_STATUS, () => store.getStatus());
}

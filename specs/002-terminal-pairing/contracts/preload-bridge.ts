/**
 * Planning-time snapshot — pairing additions to the typed preload bridge.
 *
 * Source-of-truth policy: once Phase 2 lands these shapes in `src/shared/`, the canonical
 * surface is `src/shared/bridge-api.ts` and `src/shared/pairing-types.ts`. This file is the
 * planning artifact and is NOT re-synced after that point.
 *
 * Constraints honoured:
 *   - All fields and methods are typed; no `any`.
 *   - The bridge surface is enumerable (one namespace, two methods).
 *   - The renderer never receives the device token; `PairingStatus` carries only configuration.
 *   - The bridge never accepts the device token from the renderer either; the only writable path
 *     is `submit(pairing_code)`, which is short-lived form state.
 */

// ─────────────────────────────────────────────────────────────────────────────
// pairing-types.ts (proposed)
// ─────────────────────────────────────────────────────────────────────────────

/** What the terminal currently knows about its identity. */
export type PairingStatus =
  | { kind: 'unpaired' }
  /**
   * Either the SecretStore entry is missing-but-the-table-row-is-orphaned, or the entry is
   * unreadable (DPAPI decrypt failure). Either way, treated as "needs re-pair, surface a banner."
   */
  | { kind: 'invalid'; reason: 'missing_token' | 'orphaned_row' | 'decrypt_failed' }
  | {
      kind: 'paired';
      tenant_id: string;
      branch_id: string;
      terminal_id: string;
      terminal_label: string;
      paired_at: number; // unix epoch seconds
    };

/** Outcome category of a single pair-submit attempt. */
export type PairingOutcome =
  | 'success'
  | 'invalid_code'
  | 'expired_code'
  | 'already_paired'
  | 'branch_mismatch'
  | 'rate_limited'
  | 'network_error'
  | 'unknown_error';

/** Result returned to the renderer after a submit. Discriminated for exhaustive switch. */
export type PairingSubmitResult =
  | {
      outcome: 'success';
      tenant_id: string;
      branch_id: string;
      terminal_id: string;
      terminal_label: string;
    }
  | {
      outcome: 'rate_limited';
      /** Seconds the UI MUST keep submit disabled. Clamped to [1, 300]. */
      retry_after_s: number;
    }
  | {
      outcome:
        | 'invalid_code'
        | 'expired_code'
        | 'already_paired'
        | 'branch_mismatch'
        | 'network_error'
        | 'unknown_error';
    };

// ─────────────────────────────────────────────────────────────────────────────
// bridge-api.ts (additions)
// ─────────────────────────────────────────────────────────────────────────────

/** New `pairing` namespace appended to the existing `PreloadBridgeAPI`. */
export interface PairingBridgeAPI {
  /**
   * Inspect local pairing state. Cheap; backed by a single SecretStore read + single SQL row read.
   * Renderer calls this on application boot to decide between routing to `/pairing` or `/paired`.
   */
  getStatus(): Promise<PairingStatus>;

  /**
   * Submit a pairing code (manual entry or wedge scan — bridge does not care which).
   * Resolves with a discriminated `PairingSubmitResult` for every outcome, including failures.
   * Rejects ONLY on programmer error (invalid argument shape) — backend / network failures
   * resolve with the appropriate outcome category.
   */
  submit(pairing_code: string): Promise<PairingSubmitResult>;
}

// Augmented (not redefined) into the existing PreloadBridgeAPI:
//   interface PreloadBridgeAPI {
//     ping: () => Promise<'pong'>;        // from 001
//     pairing: PairingBridgeAPI;          // from 002
//     // (future namespaces append here)
//   }

// ─────────────────────────────────────────────────────────────────────────────
// IPC channel names (canonical)
// ─────────────────────────────────────────────────────────────────────────────
//
// Enumerated, no ad-hoc strings (constitution III). The preload binds these names to the bridge
// methods above; the main process registers handlers under exactly these names.

export const PAIRING_IPC_CHANNELS = {
  GET_STATUS: 'pairing:get-status',
  SUBMIT: 'pairing:submit',
} as const;

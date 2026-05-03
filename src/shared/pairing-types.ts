// Canonical source of truth for pairing types from T005 onward.
// specs/002-terminal-pairing/contracts/preload-bridge.ts is a planning
// snapshot and is NOT re-synced after this file exists.
//
// Constraints honoured:
//   - All fields and methods are typed; no `any`.
//   - The renderer never receives the device token; PairingStatus carries
//     only configuration.
//   - The bridge never accepts the device token from the renderer either;
//     the only writable path is submit(pairing_code), which is short-lived
//     form state.

/** What the terminal currently knows about its identity. */
export type PairingStatus =
  | { kind: 'unpaired' }
  /**
   * Either the SecretStore entry is missing-but-the-table-row-is-orphaned,
   * the table row is missing while the SecretStore entry exists, or the
   * SecretStore entry exists but DPAPI cannot decrypt it. All three are
   * surfaced as "needs re-pair" with a banner reason; recovery is a normal
   * pair attempt (FR-1(c)).
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

/**
 * Result returned to the renderer after a submit. Discriminated on
 * `outcome` so callers can switch exhaustively. The success branch
 * carries only configuration (no device_token — that lives in
 * SecretStore on the main side and never crosses the bridge).
 */
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

/**
 * Canonical IPC channel names for the pairing namespace. Enumerated to
 * satisfy Constitution III (no ad-hoc strings). The preload binds these
 * names to the bridge methods; the main process registers handlers
 * under exactly these names.
 */
export const PAIRING_IPC_CHANNELS = {
  GET_STATUS: 'pairing:get-status',
  SUBMIT: 'pairing:submit',
} as const;

export type PairingIpcChannel = (typeof PAIRING_IPC_CHANNELS)[keyof typeof PAIRING_IPC_CHANNELS];

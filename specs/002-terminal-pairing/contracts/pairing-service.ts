/**
 * Planning-time snapshot — main-process PairingService interface.
 *
 * The service is the only seam that orchestrates: HTTP call → failure mapping → SecretStore +
 * SQLite persistence → log emission. Tests target this interface, not its callers (IPC handlers)
 * or its callees (network / store).
 *
 * Source-of-truth policy: once Phase 2 lands this in `src/main/pairing/service.ts`, the
 * canonical surface is the source file. This planning artifact is not re-synced after that.
 */

import type {
  PairingStatus,
  PairingSubmitResult,
} from './preload-bridge';

/** The seam tests target. Stateless aside from injected dependencies. */
export interface PairingService {
  /**
   * Read-only snapshot of the terminal's identity state.
   *
   * Invariants:
   *   - MUST NOT mutate any persisted state.
   *   - MUST emit zero log lines.
   *   - MUST NOT throw on a corrupt SecretStore entry — returns `{ kind: 'invalid', ... }`.
   */
  getStatus(): Promise<PairingStatus>;

  /**
   * Submit a pairing code.
   *
   * Invariants:
   *   - On `outcome === 'success'`: MUST persist the device token via SecretStore AND insert
   *     the terminal_assignment row in a single transactional unit. If the DB write fails after
   *     the SecretStore write, the SecretStore entry MUST be rolled back (delete) before
   *     returning `'unknown_error'`.
   *   - On any failure outcome: MUST NOT alter any persisted state — neither the SecretStore
   *     entry nor the SQLite row is touched (FR-8 / FR-14).
   *   - MUST emit exactly one `pairing_attempt` log record per call (FR-9 / NFR-6).
   *   - MUST NOT include `pairing_code` or `device_token` in any log payload, exception
   *     `cause`, or Sentry breadcrumb (FR-9 / FR-10 / NFR-4).
   *   - MUST resolve (not reject) for every backend / network outcome. Rejection is reserved
   *     for programmer error (invalid argument shape).
   */
  submit(pairing_code: string): Promise<PairingSubmitResult>;

  /**
   * Drop both halves of pairing state. Called by:
   *   - the deferred 401-interceptor when a future feature observes `device_revoked`,
   *   - tests, to set up a known-empty state.
   *
   * Invariants:
   *   - MUST clear the SecretStore entry AND the terminal_assignment row, even if one half is
   *     already missing (idempotent).
   *   - MUST NOT log the prior token's value.
   */
  clear(): Promise<void>;
}

/**
 * Dependencies the service is constructed with. Test fakes substitute each.
 */
export interface PairingServiceDeps {
  /** SecretStore from 001. */
  secretStore: {
    get(key: 'device_token'): Promise<string | null>;
    set(key: 'device_token', value: string): Promise<void>;
    delete(key: 'device_token'): Promise<void>;
    /** Returns false when DPAPI decryption failed for an existing entry. */
    isReadable(key: 'device_token'): Promise<boolean>;
  };
  /** Pairing-store wrapper around SQLite for the terminal_assignment row. */
  assignmentStore: {
    read(): Promise<null | {
      tenant_id: string;
      branch_id: string;
      terminal_id: string;
      terminal_label: string;
      paired_at: number;
    }>;
    write(row: {
      tenant_id: string;
      branch_id: string;
      terminal_id: string;
      terminal_label: string;
      paired_at: number;
    }): Promise<void>;
    delete(): Promise<void>;
  };
  /**
   * Network call. Resolves with the typed envelope on every reachable response (including
   * non-2xx); rejects ONLY on transport failure (DNS, TLS, fetch reject).
   */
  network: {
    pair(pairing_code: string): Promise<
      | {
          ok: true;
          status: 200;
          body: {
            device_token: string;
            tenant_id: string;
            branch_id: string;
            terminal_id: string;
            terminal_label: string;
            expires_at?: string | null;
          };
        }
      | {
          ok: false;
          status: number;
          body: { code?: string; message?: string };
          retry_after_s?: number; // populated only when status === 429
        }
    >;
  };
  /**
   * Schema-restricted logger emitter. The service NEVER calls a generic `logger.info(obj)`.
   */
  pairingLog: (record: {
    event: 'pairing_attempt';
    outcome:
      | 'success'
      | 'invalid_code'
      | 'expired_code'
      | 'already_paired'
      | 'branch_mismatch'
      | 'rate_limited'
      | 'network_error'
      | 'unknown_error';
    at: string; // ISO-8601 seconds
    terminal_id?: string; // success only
    retry_after_s?: number; // rate_limited only
  }) => void;
  /** Provides `new Date()` for testability of the `at` field. */
  clock: () => Date;
}

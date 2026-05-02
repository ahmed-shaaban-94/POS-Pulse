/**
 * T045 — SecretStore contract.
 *
 * One-shot transfer from `specs/001-foundation/contracts/secret-store.ts`.
 * Per plan.md § Phase 1 Source-of-truth policy, `src/shared/` is canonical
 * from this point on; the spec copy is a planning snapshot and is NOT
 * re-synced.
 *
 * Abstraction over the OS-protected secret backend. In production on
 * Windows, the implementation MUST use Electron `safeStorage` (DPAPI). In
 * dev/test, an in-memory backend is acceptable; production builds MUST
 * refuse to start if `safeStorage.isEncryptionAvailable()` is false.
 *
 * In feature 001-foundation no real credentials are stored. The contract
 * exists to (a) prove the round-trip works, (b) lock the API shape so
 * feature 002 (terminal pairing) can plug a real device token in without
 * redesign.
 *
 * IMPORTANT: implementations MUST NOT log plaintext values, include
 * plaintext in error messages, or retain decrypted values beyond the scope
 * of the caller's `get` resolution.
 */

/**
 * Canonical key shape: lowercase, dotted, kebab-allowed segments, 1–64
 * chars, must start with a letter.
 *
 * Examples: "test.placeholder", "terminal.device-token", "user.refresh-token".
 */
export type SecretKey = string & { readonly __brand: 'SecretKey' };

/**
 * Validation regex for SecretKey strings. Exported so backends can share
 * the same predicate as the constructor.
 */
export const SECRET_KEY_PATTERN = /^[a-z][a-z0-9_.-]{0,63}$/;

/**
 * Construct a `SecretKey` from a raw string. Throws on invalid input.
 * The thrown error MUST NOT include any associated secret value — only
 * the offending key text (which by spec is non-sensitive).
 */
export function makeSecretKey(raw: string): SecretKey {
  if (typeof raw !== 'string' || !SECRET_KEY_PATTERN.test(raw)) {
    throw new Error(
      `Invalid SecretKey: ${JSON.stringify(raw)}. Must match ${SECRET_KEY_PATTERN.toString()}.`,
    );
  }
  return raw as SecretKey;
}

export interface SecretStore {
  /**
   * Returns the stored value for `key`, or `null` if no entry exists.
   * MUST NOT throw on missing keys. MAY throw on backend failure.
   */
  get(key: SecretKey): Promise<string | null>;

  /**
   * Stores `value` under `key`, overwriting any prior value.
   * `value` MUST be a non-empty string. Implementations MUST encrypt at
   * rest in the production backend.
   */
  set(key: SecretKey, value: string): Promise<void>;

  /**
   * Removes the entry under `key`. Idempotent: a missing key is not an
   * error.
   */
  delete(key: SecretKey): Promise<void>;

  /**
   * Returns true if and only if the production-grade encrypted backend
   * is active for this process. Production builds MUST refuse to start
   * if this is false; dev/test builds MAY proceed with the in-memory
   * backend after logging a clear warning.
   */
  isProductionBacked(): boolean;
}

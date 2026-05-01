/**
 * Contract: SecretStore
 *
 * Abstraction over the OS-protected secret backend. In production on Windows,
 * the implementation MUST use Electron `safeStorage` (DPAPI). In dev/test, an
 * in-memory backend is acceptable; production builds MUST refuse to start if
 * `safeStorage.isEncryptionAvailable()` is false.
 *
 * This contract is the SINGLE entry point through which feature code reaches
 * stored secrets. Direct calls to `safeStorage` outside the implementation are
 * PROHIBITED.
 *
 * In feature 001-foundation no real credentials are stored. The contract
 * exists to (a) prove the round-trip works, (b) lock the API shape so feature
 * 002 (terminal pairing) can plug a real device token into it without
 * redesign.
 */

/**
 * Canonical key shape: lowercase, dotted, kebab-allowed segments.
 * Examples: "test.placeholder", "terminal.device-token", "user.refresh-token".
 */
export type SecretKey = string & { readonly __brand: "SecretKey" };

export interface SecretStore {
  /**
   * Returns the stored value for `key`, or `null` if no entry exists.
   * MUST NOT throw on missing keys. MAY throw on backend failure.
   */
  get(key: SecretKey): Promise<string | null>;

  /**
   * Stores `value` under `key`, overwriting any prior value.
   * `value` MUST be a non-empty string. Implementations MUST encrypt at rest.
   */
  set(key: SecretKey, value: string): Promise<void>;

  /**
   * Removes the entry under `key`. Idempotent: a missing key is not an error.
   */
  delete(key: SecretKey): Promise<void>;

  /**
   * Returns true if and only if the production-grade encrypted backend is
   * active for this process. Production builds MUST refuse to start if this
   * is false; dev/test builds MAY proceed with the in-memory backend after
   * logging a clear warning.
   */
  isProductionBacked(): boolean;
}

/**
 * Constructor signal: the implementation in `src/main/secrets/safe-storage.ts`
 * MUST export a function `createSecretStore()` that returns a SecretStore
 * configured per the build profile (`app.isPackaged`, `process.env.NODE_ENV`).
 *
 * No tests in this feature store real credentials. The included
 * `tests/safe-storage.test.ts` round-trips a string `"placeholder"` through
 * a key `"test.placeholder"`.
 */
export type CreateSecretStore = () => SecretStore;

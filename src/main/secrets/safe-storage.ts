import type { DatabaseHandle } from '../db/client.js';
import type { SecretKey, SecretStore } from '../../shared/secret-store.js';

/**
 * T046 — production SecretStore backend.
 *
 * Wraps Electron `safeStorage` (DPAPI on Windows) for encryption-at-rest
 * and a SQLite `secrets` table for persistence. The native binding is
 * abstracted as `SafeStorageLike` so unit tests inject a fake (R5).
 *
 * Security invariants (enforced by code review + tests):
 *   - MUST NOT log plaintext values.
 *   - MUST NOT include plaintext in error messages or stack traces.
 *   - MUST NOT retain decrypted values beyond the scope of `get()`'s
 *     resolved Promise.
 *   - `value` MUST be non-empty at `set()`. Callers `delete()` instead.
 */

/**
 * Narrow surface of Electron's `safeStorage` we depend on. Production
 * binds this to `import { safeStorage } from 'electron'`; tests pass a
 * fake. Keeping the interface small means a future fallback (e.g.,
 * keytar, libsecret) can satisfy it without touching call sites.
 */
export interface SafeStorageLike {
  isEncryptionAvailable(): boolean;
  encryptString(plain: string): Buffer;
  decryptString(buf: Buffer): string;
}

export interface CreateSafeStorageSecretStoreOptions {
  handle: DatabaseHandle;
  safeStorage: SafeStorageLike;
}

type InsertStmt = { run(key: string, value: Buffer): unknown };
type SelectStmt = { get(key: string): { value: Buffer } | undefined };
type DeleteStmt = { run(key: string): unknown };

const INSERT_SQL = 'INSERT OR REPLACE INTO secrets (key, value) VALUES (?, ?)';
const SELECT_SQL = 'SELECT value FROM secrets WHERE key = ?';
const DELETE_SQL = 'DELETE FROM secrets WHERE key = ?';

export function createSafeStorageSecretStore(
  options: CreateSafeStorageSecretStoreOptions,
): SecretStore {
  const { handle, safeStorage } = options;

  // Lazy preparation. `secrets` table comes from migrations/0002_secrets.sql
  // which runs at app boot. Eager prepare here would crash on a fresh DB
  // before the migration runner had a chance to apply 0002 — same lesson
  // as Phase 4's bindMigrationsDb regression.
  let insertStmt: InsertStmt | null = null;
  let selectStmt: SelectStmt | null = null;
  let deleteStmt: DeleteStmt | null = null;

  function rejectIfInvalidValue(value: unknown): void {
    if (typeof value !== 'string') {
      throw new TypeError('SecretStore.set: value must be a string');
    }
    if (value.length === 0) {
      throw new Error(
        'SecretStore.set: value must be non-empty. Callers must use delete() to remove a key.',
      );
    }
  }

  // Methods return Promises (per the SecretStore contract — forward-compat
  // with async backends in 002+) without `async` keyword, since
  // safeStorage and better-sqlite3 are both synchronous and
  // `async`-without-`await` trips ESLint's require-await rule.
  return {
    get(key: SecretKey): Promise<string | null> {
      selectStmt ??= handle.prepare(SELECT_SQL) as SelectStmt;
      const row = selectStmt.get(key);
      if (row === undefined) return Promise.resolve(null);
      // decryptString throws on tampered/corrupt buffers; that's a real
      // failure and propagates to the caller. We deliberately do not
      // include row.value in the error path — the buffer is ciphertext
      // but treating it as opaque keeps the policy consistent.
      return Promise.resolve(safeStorage.decryptString(row.value));
    },
    set(key: SecretKey, value: string): Promise<void> {
      try {
        rejectIfInvalidValue(value);
      } catch (err) {
        return Promise.reject(err instanceof Error ? err : new Error(String(err)));
      }
      const ciphertext = safeStorage.encryptString(value);
      insertStmt ??= handle.prepare(INSERT_SQL) as InsertStmt;
      insertStmt.run(key, ciphertext);
      return Promise.resolve();
    },
    delete(key: SecretKey): Promise<void> {
      deleteStmt ??= handle.prepare(DELETE_SQL) as DeleteStmt;
      deleteStmt.run(key);
      return Promise.resolve();
    },
    isProductionBacked(): boolean {
      return true;
    },
  };
}

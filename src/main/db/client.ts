import BetterSqlite3 from 'better-sqlite3';

/**
 * T038 — DB client.
 *
 * Thin wrapper over better-sqlite3. Exists to:
 *   1. centralize the WAL + foreign_keys pragmas applied to every connection,
 *   2. expose a small, mockable surface (`DatabaseHandle`) so tests don't have
 *      to load the native binding (R1: better-sqlite3's binary is rebuilt for
 *      Electron's Node ABI by postinstall and won't load in Vitest's system Node).
 *
 * R2: dbPath is ALWAYS injected. This module never calls `app.getPath` —
 * that lookup happens at the wire-in seam in `src/main/index.ts`.
 */

export interface DatabaseHandle {
  pragma(sql: string, options?: { simple?: boolean }): unknown;
  prepare(sql: string): unknown;
  exec(sql: string): void;
  transaction<T extends (...args: never[]) => unknown>(fn: T): T;
  close(): void;
}

export type DatabaseFactory = (dbPath: string) => DatabaseHandle;

const defaultFactory: DatabaseFactory = (dbPath) =>
  new BetterSqlite3(dbPath) as unknown as DatabaseHandle;

/**
 * Open (or create) a SQLite database at `dbPath` and apply the pragmas every
 * pos-pulse connection requires:
 *   - journal_mode = WAL  (concurrent reads while a writer is mid-transaction)
 *   - foreign_keys = ON   (SQLite default is OFF; we want referential integrity)
 *
 * Pass a custom `factory` in tests to substitute the better-sqlite3 binding.
 */
export function openDatabase(
  dbPath: string,
  factory: DatabaseFactory = defaultFactory,
): DatabaseHandle {
  const db = factory(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

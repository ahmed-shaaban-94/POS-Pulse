import type { DatabaseHandle } from '../db/client.js';
import type { SecretKey, SecretStore } from '../../shared/secret-store.js';
import type { PairingStatus } from '../../shared/pairing-types.js';

/**
 * 002-terminal-pairing T011 — pairingStore.
 *
 * The single module that touches both halves of pairing state on the
 * terminal: the device_token in the SecretStore, and the
 * terminal_assignment row in SQLite. No other module gets a SQL cursor
 * for that table (data-model.md § terminal_assignment).
 *
 * Status derivation (data-model.md):
 *
 *   token  | row     | status     | reason
 *   :----- | :------ | :--------- | :--------------
 *   missing| absent  | unpaired   | n/a
 *   ok     | present | paired     | n/a
 *   missing| present | invalid    | orphaned_row    (row sits alone)
 *   ok     | absent  | invalid    | missing_token   (token sits alone)
 *   garbled| any     | invalid    | decrypt_failed  (DPAPI cannot decrypt)
 *
 * Reason mapping rationale: `orphaned_row` describes the row's state
 * (it is orphaned); `missing_token` describes what is missing relative
 * to the row that exists. `decrypt_failed` overrides any orphan-direction
 * reason because the SecretStore is unhealthy on this machine — that is
 * the operator's first concern. The pairing-types.ts:17-22 docstring
 * sentences match this mapping verbatim.
 *
 * R1 mitigation: this module's only direct DB interaction goes through
 * the `PairingStoreDb` interface. Production binds it to a
 * better-sqlite3 `DatabaseHandle`; tests pass a sql.js-backed adapter.
 *
 * Security policy (Constitution VII + spec NFR-4 / FR-9 / FR-10):
 *   - The device_token is read from / written to the SecretStore by key
 *     and never echoed to any logger.
 *   - getStatus()'s return type is `PairingStatus`, which carries no
 *     token field — the renderer therefore never sees a token even if
 *     a future bug exposes the result.
 */

/** Row shape for the single-row terminal_assignment table. */
export interface TerminalAssignmentRow {
  tenant_id: string;
  branch_id: string;
  terminal_id: string;
  terminal_label: string;
  /** Unix epoch seconds. */
  paired_at: number;
}

/**
 * Narrow surface the pairing store needs from the database. Production
 * adapter binds this to a `DatabaseHandle` (better-sqlite3); tests pass a
 * sql.js-backed implementation. The interface is intentionally small —
 * only the operations the store performs against terminal_assignment.
 */
export interface PairingStoreDb {
  /** Read the single row, or null if absent. */
  readAssignment(): TerminalAssignmentRow | null;
  /** Write/replace the single row at id = 1. */
  writeAssignment(row: TerminalAssignmentRow): void;
  /** Delete the single row (idempotent). */
  deleteAssignment(): void;
  /** Run `fn` inside BEGIN/COMMIT; rollback + rethrow on error. */
  transaction<T>(fn: () => T): T;
}

export interface PairingStore {
  /**
   * Inspect both halves of state and return a discriminated PairingStatus
   * for the renderer to route on. Cheap; one SecretStore read + one row
   * read. Read-only — never mutates state, even on partial corruption.
   */
  getStatus(): Promise<PairingStatus>;

  /**
   * Persist a successful pairing: write the device_token to the
   * SecretStore AND insert the assignment row, in a single
   * transactional unit. Rolls back the SecretStore write if the SQL
   * write fails. Idempotent on re-pair (overwrites both halves).
   *
   * NOTE: T010-T017 (US1) does not call this from any application path
   * yet; T022+ (US2) wires it to the successful submit response.
   */
  persist(input: PersistInput): Promise<void>;

  /**
   * Drop both halves. Idempotent: a missing entry is not an error.
   * The only call path that wipes pairing state.
   */
  clear(): Promise<void>;
}

export interface PersistInput extends TerminalAssignmentRow {
  /** Opaque server-issued token. SECRET — never logged. */
  device_token: string;
}

export interface CreatePairingStoreOptions {
  secretStore: SecretStore;
  db: PairingStoreDb;
  /**
   * The SecretStore key under which the device token is held. Injected so
   * tests can use a known key and so a future feature could rotate the
   * key name without a code-wide find/replace.
   */
  deviceTokenKey: SecretKey;
}

export function createPairingStore(options: CreatePairingStoreOptions): PairingStore {
  const { secretStore, db, deviceTokenKey } = options;

  /**
   * Read the token defensively. Returns:
   *   - `{ kind: 'present', value: string }` if a non-empty value is held,
   *   - `{ kind: 'absent' }` if no entry exists,
   *   - `{ kind: 'decrypt_failed' }` if get() rejects (DPAPI failure).
   *
   * The decrypt-failed branch is the SAFE-LANDING for a corrupt-keystore
   * installation; it MUST NOT throw out of getStatus() — the renderer
   * needs to land on /pairing with a banner instead of crashing the boot.
   */
  async function readTokenState(): Promise<
    { kind: 'present' } | { kind: 'absent' } | { kind: 'decrypt_failed' }
  > {
    try {
      const value = await secretStore.get(deviceTokenKey);
      if (value === null || value.length === 0) return { kind: 'absent' };
      return { kind: 'present' };
    } catch {
      // We do NOT include the underlying error message in the result.
      // The error MAY contain ciphertext bytes or path data; treating
      // any get() rejection as decrypt_failed is the conservative,
      // logger-safe option (Constitution VII).
      return { kind: 'decrypt_failed' };
    }
  }

  return {
    async getStatus(): Promise<PairingStatus> {
      const tokenState = await readTokenState();

      // decrypt_failed dominates: the operator's first concern is
      // "the SecretStore is unhealthy on this machine". The orphan
      // direction beneath does not matter for the recovery flow.
      if (tokenState.kind === 'decrypt_failed') {
        return { kind: 'invalid', reason: 'decrypt_failed' };
      }

      const row = db.readAssignment();
      const tokenPresent = tokenState.kind === 'present';
      const rowPresent = row !== null;

      if (!tokenPresent && !rowPresent) return { kind: 'unpaired' };
      if (tokenPresent && rowPresent) {
        return {
          kind: 'paired',
          tenant_id: row.tenant_id,
          branch_id: row.branch_id,
          terminal_id: row.terminal_id,
          terminal_label: row.terminal_label,
          paired_at: row.paired_at,
        };
      }
      // tokenPresent XOR rowPresent — orphan in one direction.
      if (rowPresent) return { kind: 'invalid', reason: 'orphaned_row' };
      return { kind: 'invalid', reason: 'missing_token' };
    },

    async persist(input: PersistInput): Promise<void> {
      // Atomicity contract:
      //   1. Write the SecretStore (token) FIRST so a SQL failure can be
      //      compensated by deleting the token.
      //   2. Open a SQL transaction; write the row; commit.
      //   3. If the SQL transaction throws, compensate by deleting the
      //      token from the SecretStore. Both halves are then back to
      //      their pre-call state.
      //
      // Doing it in this order means a hard process crash between (1)
      // and (2) leaves an orphaned token, which getStatus() reports as
      // `invalid/missing_token`; the operator re-pairs and is back to
      // a consistent state. The reverse order would leave an orphaned
      // row instead — same recovery surface, different reason.
      await secretStore.set(deviceTokenKey, input.device_token);
      try {
        db.transaction(() => {
          db.writeAssignment({
            tenant_id: input.tenant_id,
            branch_id: input.branch_id,
            terminal_id: input.terminal_id,
            terminal_label: input.terminal_label,
            paired_at: input.paired_at,
          });
        });
      } catch (err) {
        // Compensation. We deliberately swallow any error from delete()
        // because the original SQL failure is the load-bearing one to
        // surface; a stacked compensation failure would obscure it.
        await secretStore.delete(deviceTokenKey).catch(() => {
          /* noop — original SQL error is the one the caller cares about */
        });
        throw err;
      }
    },

    async clear(): Promise<void> {
      // Both deletes are idempotent. The order does not matter for
      // correctness — clear() is the only path that wipes state and
      // there is no in-flight reader to race with.
      db.deleteAssignment();
      await secretStore.delete(deviceTokenKey);
    },
  };
}

/**
 * Adapt a `DatabaseHandle` (better-sqlite3) to `PairingStoreDb`. Used at
 * the production wire-in site (`src/main/index.ts`); tests pass their
 * own adapter (sql.js-backed in store.test.ts).
 *
 * Statements are prepared LAZILY (on first use), mirroring the
 * `bindMigrationsDb` pattern: eager preparation would crash on a fresh
 * DB before the migration runner had a chance to apply
 * `0003_terminal_assignment`.
 */
export function bindPairingStoreDb(handle: DatabaseHandle): PairingStoreDb {
  type SelectStmt = { get(): TerminalAssignmentRow | undefined };
  type RunStmt = { run(...params: unknown[]): unknown };

  let selectStmt: SelectStmt | null = null;
  let insertStmt: RunStmt | null = null;
  let deleteStmt: RunStmt | null = null;

  return {
    readAssignment(): TerminalAssignmentRow | null {
      selectStmt ??= handle.prepare(
        'SELECT tenant_id, branch_id, terminal_id, terminal_label, paired_at FROM terminal_assignment WHERE id = 1',
      ) as SelectStmt;
      const row = selectStmt.get();
      return row === undefined ? null : row;
    },
    writeAssignment(row: TerminalAssignmentRow): void {
      insertStmt ??= handle.prepare(
        `INSERT OR REPLACE INTO terminal_assignment
           (id, tenant_id, branch_id, terminal_id, terminal_label, paired_at)
         VALUES (1, ?, ?, ?, ?, ?)`,
      ) as RunStmt;
      insertStmt.run(
        row.tenant_id,
        row.branch_id,
        row.terminal_id,
        row.terminal_label,
        row.paired_at,
      );
    },
    deleteAssignment(): void {
      deleteStmt ??= handle.prepare('DELETE FROM terminal_assignment WHERE id = 1') as RunStmt;
      deleteStmt.run();
    },
    transaction<T>(fn: () => T): T {
      // better-sqlite3's transaction() returns a wrapped callable.
      const wrapped = handle.transaction(fn as never) as unknown as () => T;
      return wrapped();
    },
  };
}

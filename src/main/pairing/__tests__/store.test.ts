import { afterEach, describe, expect, it, vi } from 'vitest';
import initSqlJs, { type Database as SqlJsDatabase } from 'sql.js';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import {
  bindPairingStoreDb,
  createPairingStore,
  type PairingStore,
  type PairingStoreDb,
  type TerminalAssignmentRow,
} from '../store.js';
import { createInMemorySecretStore } from '../../secrets/in-memory.js';
import { makeSecretKey, type SecretKey, type SecretStore } from '../../../shared/secret-store.js';
import type { DatabaseHandle } from '../../db/client.js';
import type { PairingStatus } from '../../../shared/pairing-types.js';

/**
 * 002-terminal-pairing T010 — pairingStore.getStatus() / persist() / clear().
 *
 * The store is the only module that touches both halves of pairing state
 * (SecretStore + terminal_assignment row). It SHOULD be testable without
 * the real `better-sqlite3` native binding (R1 from 001 — system Node in
 * Vitest cannot load Electron-rebuilt natives). We use:
 *
 *   - the in-memory SecretStore from 001 (`createInMemorySecretStore`),
 *     wrapped to surface a decrypt failure when asked, and
 *   - `sql.js` (pure-JS WASM SQLite, devDep from PR#15) backing a small
 *     PairingStoreDb adapter, with the actual `0003_terminal_assignment`
 *     migration applied so we exercise the live SQL contract.
 *
 * Production path remains better-sqlite3 in Electron; the manual smoke
 * (T017) exercises that.
 *
 * Status-table mapping (from data-model.md § "Status derivation logic" +
 * pairing-types.ts:17-22):
 *
 *   token  | row    | status     | reason
 *   :----- | :----- | :--------- | :--------------
 *   missing| absent | unpaired   | n/a
 *   ok     | present| paired     | n/a
 *   missing| present| invalid    | orphaned_row
 *   ok     | absent | invalid    | missing_token
 *   garbled| any    | invalid    | decrypt_failed
 */

const __dirnameForFile = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirnameForFile, '..', '..', '..', '..');
const MIGRATION_SQL = readFileSync(
  path.join(REPO_ROOT, 'migrations', '0003_terminal_assignment.sql'),
  'utf8',
);

const DEVICE_TOKEN_KEY: SecretKey = makeSecretKey('terminal.device-token');

interface TestHarness {
  db: SqlJsDatabase;
  storeDb: PairingStoreDb;
  secretStore: SecretStore;
  store: PairingStore;
}

/**
 * Build a sql.js-backed PairingStoreDb. The store's PairingStoreDb shape
 * is intentionally narrow — only what the store reads/writes for the
 * `terminal_assignment` table.
 */
function makeSqlJsAdapter(db: SqlJsDatabase): PairingStoreDb {
  return {
    readAssignment() {
      const stmt = db.prepare(
        'SELECT tenant_id, branch_id, terminal_id, terminal_label, paired_at FROM terminal_assignment WHERE id = 1',
      );
      try {
        if (!stmt.step()) return null;
        const row = stmt.getAsObject();
        return {
          tenant_id: row['tenant_id'] as string,
          branch_id: row['branch_id'] as string,
          terminal_id: row['terminal_id'] as string,
          terminal_label: row['terminal_label'] as string,
          paired_at: row['paired_at'] as number,
        };
      } finally {
        stmt.free();
      }
    },
    writeAssignment(row) {
      // INSERT OR REPLACE keeps the single-row invariant honest under the
      // CHECK (id = 1) constraint without first DELETing.
      db.run(
        `INSERT OR REPLACE INTO terminal_assignment
           (id, tenant_id, branch_id, terminal_id, terminal_label, paired_at)
         VALUES (1, ?, ?, ?, ?, ?)`,
        [row.tenant_id, row.branch_id, row.terminal_id, row.terminal_label, row.paired_at],
      );
    },
    deleteAssignment() {
      db.run('DELETE FROM terminal_assignment WHERE id = 1');
    },
    transaction(fn) {
      db.run('BEGIN');
      try {
        const result = fn();
        db.run('COMMIT');
        return result;
      } catch (err) {
        db.run('ROLLBACK');
        throw err;
      }
    },
  };
}

/**
 * Wrap the in-memory SecretStore so a test can force a "decrypt failed"
 * presentation: get() rejects with a decrypt-shaped Error. Mirrors the
 * production behaviour where DPAPI throws on a tampered ciphertext.
 */
function makeDecryptFailingSecretStore(inner: SecretStore): SecretStore {
  return {
    get: () => Promise.reject(new Error('safeStorage.decryptString: decryption failed')),
    set: (k, v) => inner.set(k, v),
    delete: (k) => inner.delete(k),
    isProductionBacked: () => inner.isProductionBacked(),
  };
}

async function makeHarness(opts: { secretStore?: SecretStore } = {}): Promise<TestHarness> {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.run(MIGRATION_SQL);
  const storeDb = makeSqlJsAdapter(db);
  const secretStore = opts.secretStore ?? createInMemorySecretStore();
  const store = createPairingStore({
    secretStore,
    db: storeDb,
    deviceTokenKey: DEVICE_TOKEN_KEY,
  });
  return { db, storeDb, secretStore, store };
}

describe('createPairingStore.getStatus()', () => {
  let h: TestHarness | undefined;
  afterEach(() => {
    h?.db.close();
    h = undefined;
  });

  it('returns kind="unpaired" when token is missing AND row is absent', async () => {
    h = await makeHarness();
    const status = await h.store.getStatus();
    expect(status).toEqual<PairingStatus>({ kind: 'unpaired' });
  });

  it('returns kind="paired" with row fields when token is present AND row is present', async () => {
    h = await makeHarness();
    await h.secretStore.set(DEVICE_TOKEN_KEY, 'opaque-token-value');
    h.storeDb.writeAssignment({
      tenant_id: 'tenant-A',
      branch_id: 'branch-B',
      terminal_id: 'terminal-C',
      terminal_label: 'Counter 1',
      paired_at: 1735689600,
    });

    const status = await h.store.getStatus();
    expect(status).toEqual<PairingStatus>({
      kind: 'paired',
      tenant_id: 'tenant-A',
      branch_id: 'branch-B',
      terminal_id: 'terminal-C',
      terminal_label: 'Counter 1',
      paired_at: 1735689600,
    });
  });

  it('returns kind="invalid" reason="orphaned_row" when token is missing but row is present', async () => {
    h = await makeHarness();
    h.storeDb.writeAssignment({
      tenant_id: 't',
      branch_id: 'b',
      terminal_id: 'term',
      terminal_label: 'Counter',
      paired_at: 1735689600,
    });

    const status = await h.store.getStatus();
    expect(status).toEqual<PairingStatus>({ kind: 'invalid', reason: 'orphaned_row' });
  });

  it('returns kind="invalid" reason="missing_token" when token is present but row is absent', async () => {
    h = await makeHarness();
    await h.secretStore.set(DEVICE_TOKEN_KEY, 'opaque-token-value');

    const status = await h.store.getStatus();
    expect(status).toEqual<PairingStatus>({ kind: 'invalid', reason: 'missing_token' });
  });

  it('returns kind="invalid" reason="decrypt_failed" when SecretStore.get rejects (DPAPI decrypt failure)', async () => {
    // Token "exists" (set succeeded) but get() rejects with a decrypt-shaped
    // error. The store MUST surface this as `invalid/decrypt_failed`, NOT as
    // an unhandled rejection — even though the row is also present.
    const failingStore = makeDecryptFailingSecretStore(createInMemorySecretStore());
    await failingStore.set(DEVICE_TOKEN_KEY, 'sentinel-only-set-not-read');
    h = await makeHarness({ secretStore: failingStore });
    h.storeDb.writeAssignment({
      tenant_id: 't',
      branch_id: 'b',
      terminal_id: 'term',
      terminal_label: 'Counter',
      paired_at: 1735689600,
    });

    const status = await h.store.getStatus();
    expect(status).toEqual<PairingStatus>({ kind: 'invalid', reason: 'decrypt_failed' });
  });

  it('returns kind="invalid" reason="decrypt_failed" even when the row is absent', async () => {
    // decrypt_failed beats orphan-direction reasons because the operator's
    // first concern is "the SecretStore is unhealthy on this machine".
    const failingStore = makeDecryptFailingSecretStore(createInMemorySecretStore());
    await failingStore.set(DEVICE_TOKEN_KEY, 'x');
    h = await makeHarness({ secretStore: failingStore });

    const status = await h.store.getStatus();
    expect(status).toEqual<PairingStatus>({ kind: 'invalid', reason: 'decrypt_failed' });
  });

  it('does not mutate any state on getStatus() (read-only)', async () => {
    h = await makeHarness();
    await h.secretStore.set(DEVICE_TOKEN_KEY, 'opaque-token');
    h.storeDb.writeAssignment({
      tenant_id: 't',
      branch_id: 'b',
      terminal_id: 'term',
      terminal_label: 'Counter',
      paired_at: 1735689600,
    });

    await h.store.getStatus();
    await h.store.getStatus();

    // Both halves still present after two reads.
    expect(await h.secretStore.get(DEVICE_TOKEN_KEY)).toBe('opaque-token');
    expect(h.storeDb.readAssignment()).not.toBeNull();
  });
});

describe('createPairingStore.persist()', () => {
  let h: TestHarness | undefined;
  afterEach(() => {
    h?.db.close();
    h = undefined;
  });

  it('writes the device_token to SecretStore AND the row to terminal_assignment in a single unit', async () => {
    h = await makeHarness();
    await h.store.persist({
      device_token: 'opaque-token-value',
      tenant_id: 'tenant-A',
      branch_id: 'branch-B',
      terminal_id: 'terminal-C',
      terminal_label: 'Counter 1',
      paired_at: 1735689600,
    });

    expect(await h.secretStore.get(DEVICE_TOKEN_KEY)).toBe('opaque-token-value');
    const row = h.storeDb.readAssignment();
    expect(row).toEqual({
      tenant_id: 'tenant-A',
      branch_id: 'branch-B',
      terminal_id: 'terminal-C',
      terminal_label: 'Counter 1',
      paired_at: 1735689600,
    });
  });

  it('rolls back the SecretStore write if the SQL write fails', async () => {
    // Inject a storeDb whose writeAssignment throws; persist() MUST then
    // ensure the SecretStore does not hold the token afterwards (FR-8 is
    // about failed pair attempts; same atomicity applies to local writes).
    h = await makeHarness();
    const baseDb = h.storeDb;
    const failingDb: PairingStoreDb = {
      ...baseDb,
      writeAssignment: () => {
        throw new Error('forced SQL failure');
      },
    };
    const failingStore = createPairingStore({
      secretStore: h.secretStore,
      db: failingDb,
      deviceTokenKey: DEVICE_TOKEN_KEY,
    });

    await expect(
      failingStore.persist({
        device_token: 'opaque-token',
        tenant_id: 't',
        branch_id: 'b',
        terminal_id: 'term',
        terminal_label: 'Counter',
        paired_at: 1735689600,
      }),
    ).rejects.toThrow(/forced SQL failure/);

    // Token MUST NOT be left behind.
    expect(await h.secretStore.get(DEVICE_TOKEN_KEY)).toBeNull();
    // Row MUST NOT be left behind either (writeAssignment threw before commit).
    expect(baseDb.readAssignment()).toBeNull();
  });

  it('overwrites a prior assignment + token (idempotent re-pair)', async () => {
    h = await makeHarness();
    await h.store.persist({
      device_token: 'first',
      tenant_id: 't1',
      branch_id: 'b1',
      terminal_id: 'term1',
      terminal_label: 'First',
      paired_at: 1735689600,
    });
    await h.store.persist({
      device_token: 'second',
      tenant_id: 't2',
      branch_id: 'b2',
      terminal_id: 'term2',
      terminal_label: 'Second',
      paired_at: 1735689700,
    });

    expect(await h.secretStore.get(DEVICE_TOKEN_KEY)).toBe('second');
    expect(h.storeDb.readAssignment()).toEqual({
      tenant_id: 't2',
      branch_id: 'b2',
      terminal_id: 'term2',
      terminal_label: 'Second',
      paired_at: 1735689700,
    });
  });
});

describe('createPairingStore.clear()', () => {
  let h: TestHarness | undefined;
  afterEach(() => {
    h?.db.close();
    h = undefined;
  });

  it('removes BOTH the SecretStore entry and the terminal_assignment row', async () => {
    h = await makeHarness();
    await h.store.persist({
      device_token: 'opaque',
      tenant_id: 't',
      branch_id: 'b',
      terminal_id: 'term',
      terminal_label: 'Counter',
      paired_at: 1735689600,
    });

    await h.store.clear();

    expect(await h.secretStore.get(DEVICE_TOKEN_KEY)).toBeNull();
    expect(h.storeDb.readAssignment()).toBeNull();
  });

  it('is idempotent: clearing twice is a no-op', async () => {
    h = await makeHarness();
    await h.store.clear(); // already empty
    await expect(h.store.clear()).resolves.not.toThrow();
    expect(await h.secretStore.get(DEVICE_TOKEN_KEY)).toBeNull();
    expect(h.storeDb.readAssignment()).toBeNull();
  });

  it('drops the orphaned half on clear (orphaned_row recovery)', async () => {
    h = await makeHarness();
    h.storeDb.writeAssignment({
      tenant_id: 't',
      branch_id: 'b',
      terminal_id: 'term',
      terminal_label: 'Counter',
      paired_at: 1735689600,
    });

    await h.store.clear();

    expect(h.storeDb.readAssignment()).toBeNull();
  });

  it('drops the orphaned half on clear (orphaned-token recovery)', async () => {
    h = await makeHarness();
    await h.secretStore.set(DEVICE_TOKEN_KEY, 'opaque-token');

    await h.store.clear();

    expect(await h.secretStore.get(DEVICE_TOKEN_KEY)).toBeNull();
  });
});

/**
 * T068 (US7) — invalid-reason discriminator semantic block.
 *
 * T010 already asserts all three `invalid` reasons; this describe
 * groups them explicitly under a US7 label so the test report makes
 * the coverage surface discoverable. Tests will be green from write —
 * that is the intended outcome (no new production code is required).
 */
describe('createPairingStore.getStatus() — US7 invalid reason discriminator (T068)', () => {
  let h: TestHarness | undefined;
  afterEach(() => {
    h?.db.close();
    h = undefined;
  });

  it('returns reason="missing_token" when token present but row absent', async () => {
    h = await makeHarness();
    await h.secretStore.set(DEVICE_TOKEN_KEY, 'opaque-token');

    const status = await h.store.getStatus();
    expect(status).toEqual<PairingStatus>({ kind: 'invalid', reason: 'missing_token' });
  });

  it('returns reason="orphaned_row" when row present but token absent', async () => {
    h = await makeHarness();
    h.storeDb.writeAssignment({
      tenant_id: 't',
      branch_id: 'b',
      terminal_id: 'term',
      terminal_label: 'Counter',
      paired_at: 1735689600,
    });

    const status = await h.store.getStatus();
    expect(status).toEqual<PairingStatus>({ kind: 'invalid', reason: 'orphaned_row' });
  });

  it('returns reason="decrypt_failed" when SecretStore.get() rejects (corrupt SecretStore)', async () => {
    const failingStore = makeDecryptFailingSecretStore(createInMemorySecretStore());
    await failingStore.set(DEVICE_TOKEN_KEY, 'x');
    h = await makeHarness({ secretStore: failingStore });
    h.storeDb.writeAssignment({
      tenant_id: 't',
      branch_id: 'b',
      terminal_id: 'term',
      terminal_label: 'Counter',
      paired_at: 1735689600,
    });

    const status = await h.store.getStatus();
    expect(status).toEqual<PairingStatus>({ kind: 'invalid', reason: 'decrypt_failed' });
  });
});

/**
 * T071 (US7) — clear() token-leak guard.
 *
 * Extends the existing clear() suite with a spy-based assertion that
 * the token VALUE is never passed to secretStore.delete() — only the
 * SecretKey is forwarded.
 */
describe('createPairingStore.clear() — US7 token-leak guard (T071)', () => {
  let h: TestHarness | undefined;
  afterEach(() => {
    h?.db.close();
    h = undefined;
  });

  it('passes only the SecretKey to secretStore.delete(), never the token value', async () => {
    h = await makeHarness();
    const distinctToken = 'TOKEN-VALUE-FOR-LEAK-TEST-ZZZZZ';
    await h.store.persist({
      device_token: distinctToken,
      tenant_id: 't',
      branch_id: 'b',
      terminal_id: 'term',
      terminal_label: 'Counter',
      paired_at: 1735689600,
    });

    const deleteSpy = vi.spyOn(h.secretStore, 'delete');
    await h.store.clear();

    // delete() must have been called exactly once with the key, not the value.
    expect(deleteSpy).toHaveBeenCalledTimes(1);
    expect(deleteSpy).toHaveBeenCalledWith(DEVICE_TOKEN_KEY);

    // Belt-and-braces: confirm the token string does not appear anywhere
    // in the recorded call arguments.
    const callLog = JSON.stringify(deleteSpy.mock.calls);
    expect(callLog).not.toContain(distinctToken);
  });
});

/**
 * Adapter coverage for `bindPairingStoreDb` — mirrors the 001 pattern in
 * `migrate.test.ts § bindMigrationsDb`: hand-rolled mock DatabaseHandle so
 * the better-sqlite3 native binding never loads (R1). Real SQL semantics
 * are covered by the sql.js suite above; THIS suite only verifies the
 * adapter wires the prepared statements correctly and prepares them
 * lazily.
 */
describe('bindPairingStoreDb', () => {
  type SelectStmt = {
    get: ReturnType<typeof vi.fn>;
  };
  type RunStmt = {
    run: ReturnType<typeof vi.fn>;
  };

  function makeMockHandle(opts: { selectRow?: TerminalAssignmentRow | undefined } = {}): {
    handle: DatabaseHandle;
    prepareSpy: ReturnType<typeof vi.fn>;
    selectStmt: SelectStmt;
    insertStmt: RunStmt;
    deleteStmt: RunStmt;
    transactionCalls: number;
  } {
    const selectStmt: SelectStmt = { get: vi.fn(() => opts.selectRow) };
    const insertStmt: RunStmt = { run: vi.fn() };
    const deleteStmt: RunStmt = { run: vi.fn() };
    let transactionCalls = 0;

    const prepareSpy = vi.fn((sql: string) => {
      if (/INSERT OR REPLACE INTO terminal_assignment/i.test(sql)) return insertStmt;
      if (/SELECT .* FROM terminal_assignment WHERE id = 1/i.test(sql)) return selectStmt;
      if (/DELETE FROM terminal_assignment WHERE id = 1/i.test(sql)) return deleteStmt;
      return { get: vi.fn(), run: vi.fn() };
    });

    const handle = {
      pragma: vi.fn(),
      prepare: prepareSpy,
      exec: vi.fn(),
      transaction: vi.fn((fn: (...args: never[]) => unknown) => {
        return (...args: never[]) => {
          transactionCalls += 1;
          return fn(...args);
        };
      }),
      close: vi.fn(),
    } as unknown as DatabaseHandle;

    return {
      handle,
      prepareSpy,
      selectStmt,
      insertStmt,
      deleteStmt,
      get transactionCalls(): number {
        return transactionCalls;
      },
    };
  }

  it('does not prepare any statement at bind time (lazy preparation)', () => {
    const m = makeMockHandle();
    bindPairingStoreDb(m.handle);
    expect(m.prepareSpy).not.toHaveBeenCalled();
  });

  it('readAssignment returns null when the underlying SELECT yields no row', () => {
    const m = makeMockHandle({ selectRow: undefined });
    const db = bindPairingStoreDb(m.handle);
    expect(db.readAssignment()).toBeNull();
    expect(m.selectStmt.get).toHaveBeenCalledTimes(1);
  });

  it('readAssignment returns the row payload when the underlying SELECT yields a row', () => {
    const row: TerminalAssignmentRow = {
      tenant_id: 'tenant',
      branch_id: 'branch',
      terminal_id: 'term',
      terminal_label: 'Counter 1',
      paired_at: 1735689600,
    };
    const m = makeMockHandle({ selectRow: row });
    const db = bindPairingStoreDb(m.handle);
    expect(db.readAssignment()).toEqual(row);
  });

  it('writeAssignment forwards the row positionally to the prepared INSERT', () => {
    const m = makeMockHandle();
    const db = bindPairingStoreDb(m.handle);
    const row: TerminalAssignmentRow = {
      tenant_id: 'tenant',
      branch_id: 'branch',
      terminal_id: 'term',
      terminal_label: 'Counter 1',
      paired_at: 1735689600,
    };
    db.writeAssignment(row);
    expect(m.insertStmt.run).toHaveBeenCalledWith(
      'tenant',
      'branch',
      'term',
      'Counter 1',
      1735689600,
    );
  });

  it('deleteAssignment runs the prepared DELETE with no params', () => {
    const m = makeMockHandle();
    const db = bindPairingStoreDb(m.handle);
    db.deleteAssignment();
    expect(m.deleteStmt.run).toHaveBeenCalledTimes(1);
    expect(m.deleteStmt.run).toHaveBeenCalledWith();
  });

  it('transaction wraps fn via handle.transaction and invokes the wrapped callable', () => {
    const m = makeMockHandle();
    const db = bindPairingStoreDb(m.handle);
    let ran = false;
    const result = db.transaction(() => {
      ran = true;
      return 99;
    });
    expect(ran).toBe(true);
    expect(result).toBe(99);
    expect(m.transactionCalls).toBe(1);
  });

  it('reuses prepared statements across multiple calls (cached after first use)', () => {
    const m = makeMockHandle();
    const db = bindPairingStoreDb(m.handle);
    db.readAssignment();
    db.readAssignment();
    db.readAssignment();
    // The SELECT statement was prepared exactly once; subsequent reads
    // hit the cached statement.
    const selectPrepares = m.prepareSpy.mock.calls.filter((c) =>
      /SELECT .* FROM terminal_assignment/i.test(c[0] as string),
    );
    expect(selectPrepares).toHaveLength(1);
  });
});

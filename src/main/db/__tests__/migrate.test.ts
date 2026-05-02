import { describe, it, expect, vi } from 'vitest';
import { createHash } from 'crypto';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import os from 'os';
import path from 'path';

import {
  bindMigrationsDb,
  readMigrationsFromDisk,
  runMigrations,
  type AppliedRow,
  type MigrationFile,
  type MigrationsDb,
} from '../migrate.js';
import type { DatabaseHandle } from '../client.js';

/**
 * T036 — failing migration-runner unit tests.
 *
 * The runner is unit-tested against an in-memory fake of the
 * better-sqlite3 surface it actually uses. Real DB behavior (transactions,
 * WAL, native binding) is verified by T041 manual smoke. R1 mitigation.
 */

/**
 * Minimal in-memory fake. It tracks:
 *   - which "tables" exist (we only care about schema_migrations + smoke flags)
 *   - rows in schema_migrations
 *   - which raw SQL fragments were exec'd in order
 *   - whether transactions committed or rolled back
 */
function makeFakeDb(options: { failOnSql?: string } = {}): {
  db: MigrationsDb;
  applied: AppliedRow[];
  execLog: string[];
  transactionsCommitted: number;
  transactionsRolledBack: number;
  schemaMigrationsExists: () => boolean;
} {
  let schemaMigrationsTableCreated = false;
  const applied: AppliedRow[] = [];
  const execLog: string[] = [];
  let txDepth = 0;
  let txStaging: AppliedRow[] = [];
  let txStagingExec: string[] = [];
  const counters = { transactionsCommitted: 0, transactionsRolledBack: 0 };

  const db: MigrationsDb = {
    exec(sql: string): void {
      // Intercept the bootstrap CREATE so test can verify it ran before any migration.
      if (/CREATE TABLE IF NOT EXISTS schema_migrations/i.test(sql)) {
        schemaMigrationsTableCreated = true;
        return;
      }
      if (options.failOnSql && sql.includes(options.failOnSql)) {
        throw new Error(`fake DB: forced failure on SQL containing "${options.failOnSql}"`);
      }
      if (txDepth > 0) {
        txStagingExec.push(sql);
      } else {
        execLog.push(sql);
      }
    },
    listAppliedNames(): string[] {
      if (!schemaMigrationsTableCreated) {
        throw new Error('fake DB: schema_migrations does not exist yet');
      }
      return applied.map((r) => r.name);
    },
    recordApplied(row: AppliedRow): void {
      if (txDepth > 0) {
        txStaging.push(row);
      } else {
        applied.push(row);
      }
    },
    transaction<T>(fn: () => T): T {
      txDepth += 1;
      txStaging = [];
      txStagingExec = [];
      try {
        const result = fn();
        // Commit: promote staged writes to the real arrays.
        applied.push(...txStaging);
        execLog.push(...txStagingExec);
        counters.transactionsCommitted += 1;
        return result;
      } catch (err) {
        // Rollback: drop staged writes.
        counters.transactionsRolledBack += 1;
        throw err;
      } finally {
        txStaging = [];
        txStagingExec = [];
        txDepth -= 1;
      }
    },
  };

  return {
    db,
    applied,
    execLog,
    get transactionsCommitted(): number {
      return counters.transactionsCommitted;
    },
    get transactionsRolledBack(): number {
      return counters.transactionsRolledBack;
    },
    schemaMigrationsExists: () => schemaMigrationsTableCreated,
  };
}

function sha256(s: string): string {
  return createHash('sha256').update(s, 'utf8').digest('hex');
}

// Use a placeholder DDL distinct from the bootstrap CREATE so the test fake
// can tell "the runner ensured the bookkeeping table" apart from "the runner
// applied migration 0001". In production, 0001_init.sql IS the bootstrap
// itself, but the runner runs CREATE TABLE IF NOT EXISTS schema_migrations
// independently before any file, so the duplication is harmless.
const FILE_INIT: MigrationFile = {
  name: '0001_init',
  sql: 'CREATE TABLE init_marker (id INTEGER PRIMARY KEY);',
};
const FILE_SMOKE: MigrationFile = {
  name: '0002_smoke',
  sql: 'CREATE TABLE smoke (id INTEGER PRIMARY KEY);',
};
const FILE_THIRD: MigrationFile = {
  name: '0003_more',
  sql: 'CREATE TABLE more (id INTEGER PRIMARY KEY);',
};

describe('runMigrations', () => {
  it('creates schema_migrations bootstrap before applying any file', () => {
    const fake = makeFakeDb();
    runMigrations({ db: fake.db, files: [FILE_INIT] });
    expect(fake.schemaMigrationsExists()).toBe(true);
  });

  it('applies pending migrations in sorted (name-ascending) order', () => {
    const fake = makeFakeDb();
    // Provide files out of order; runner must sort them.
    runMigrations({ db: fake.db, files: [FILE_SMOKE, FILE_INIT, FILE_THIRD] });
    expect(fake.applied.map((r) => r.name)).toEqual(['0001_init', '0002_smoke', '0003_more']);
    // exec order also matches sort order
    expect(fake.execLog).toEqual([FILE_INIT.sql, FILE_SMOKE.sql, FILE_THIRD.sql]);
  });

  it('records (name, applied_at, sha256 checksum) for each applied migration', () => {
    const fake = makeFakeDb();
    runMigrations({ db: fake.db, files: [FILE_INIT, FILE_SMOKE] });
    expect(fake.applied).toHaveLength(2);
    expect(fake.applied[0]?.name).toBe('0001_init');
    expect(fake.applied[0]?.checksum).toBe(sha256(FILE_INIT.sql));
    expect(fake.applied[0]?.applied_at).toMatch(/^\d{4}-\d{2}-\d{2}T/); // ISO-8601 leading
    expect(fake.applied[1]?.name).toBe('0002_smoke');
    expect(fake.applied[1]?.checksum).toBe(sha256(FILE_SMOKE.sql));
  });

  it('is idempotent on re-run: skips files already in schema_migrations', () => {
    const fake = makeFakeDb();
    runMigrations({ db: fake.db, files: [FILE_INIT, FILE_SMOKE] });
    const firstRunCount = fake.applied.length;
    const firstRunCommits = fake.transactionsCommitted;

    // Second run with the same files — nothing new should apply.
    runMigrations({ db: fake.db, files: [FILE_INIT, FILE_SMOKE] });

    expect(fake.applied).toHaveLength(firstRunCount);
    expect(fake.transactionsCommitted).toBe(firstRunCommits);
  });

  it('rolls back and rethrows when a migration SQL fails (no row written)', () => {
    const fake = makeFakeDb({ failOnSql: 'CREATE TABLE smoke' });

    // 0001_init applies cleanly; 0002_smoke fails inside its transaction.
    expect(() => {
      runMigrations({ db: fake.db, files: [FILE_INIT, FILE_SMOKE] });
    }).toThrow(/forced failure/);

    // 0001_init's row IS present (it committed); 0002_smoke's row is NOT.
    expect(fake.applied.map((r) => r.name)).toEqual(['0001_init']);
    expect(fake.transactionsCommitted).toBe(1);
    expect(fake.transactionsRolledBack).toBe(1);
  });

  it('halt-launch semantics: thrown error propagates so app.whenReady can app.exit(1)', () => {
    const fake = makeFakeDb({ failOnSql: 'CREATE TABLE smoke' });
    let caughtMessage: string | null = null;
    try {
      runMigrations({ db: fake.db, files: [FILE_INIT, FILE_SMOKE] });
    } catch (err) {
      caughtMessage = err instanceof Error ? err.message : String(err);
    }
    expect(caughtMessage).not.toBeNull();
    expect(caughtMessage).toMatch(/forced failure/);
  });
});

/**
 * Coverage for the filesystem adapter. Uses a real temp dir — no native
 * binding involved, so safe in Vitest (R1 stays clean).
 */
describe('readMigrationsFromDisk', () => {
  function makeTempMigrationsDir(files: Record<string, string>): string {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'pos-pulse-mig-'));
    for (const [name, contents] of Object.entries(files)) {
      writeFileSync(path.join(dir, name), contents, 'utf8');
    }
    return dir;
  }

  it('returns *.sql files sorted by name, with extension stripped', () => {
    const dir = makeTempMigrationsDir({
      '0002_b.sql': 'SELECT 2;',
      '0001_a.sql': 'SELECT 1;',
      'README.md': 'not a migration',
    });
    try {
      const files = readMigrationsFromDisk(dir);
      expect(files).toEqual([
        { name: '0001_a', sql: 'SELECT 1;' },
        { name: '0002_b', sql: 'SELECT 2;' },
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('ignores subdirectories and non-.sql files', () => {
    const dir = makeTempMigrationsDir({ '0001_a.sql': 'SELECT 1;' });
    try {
      mkdirSync(path.join(dir, 'subdir'));
      writeFileSync(path.join(dir, 'notes.txt'), 'hello', 'utf8');
      const files = readMigrationsFromDisk(dir);
      expect(files.map((f) => f.name)).toEqual(['0001_a']);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

/**
 * Coverage for the better-sqlite3 → MigrationsDb adapter. Uses a hand-rolled
 * mock DatabaseHandle so we never load the native binding (R1).
 */
describe('bindMigrationsDb', () => {
  type StmtMock = {
    all: ReturnType<typeof vi.fn>;
    run: ReturnType<typeof vi.fn>;
  };

  function makeMockHandle(opts: { selectRows?: Array<{ name: string }> } = {}): {
    handle: DatabaseHandle;
    prepareSpy: ReturnType<typeof vi.fn>;
    insertStmt: StmtMock;
    selectStmt: StmtMock;
    execCalls: string[];
    transactionCalls: number;
  } {
    const insertStmt: StmtMock = { all: vi.fn(), run: vi.fn() };
    const selectStmt: StmtMock = { all: vi.fn(() => opts.selectRows ?? []), run: vi.fn() };
    const execCalls: string[] = [];
    let transactionCalls = 0;

    const prepareSpy = vi.fn((sql: string) => {
      if (/INSERT INTO schema_migrations/i.test(sql)) return insertStmt;
      if (/SELECT name FROM schema_migrations/i.test(sql)) return selectStmt;
      return { all: vi.fn(), run: vi.fn() };
    });

    const handle = {
      pragma: vi.fn(),
      prepare: prepareSpy,
      exec: vi.fn((sql: string) => {
        execCalls.push(sql);
      }),
      // better-sqlite3's transaction() returns a wrapped callable; mimic that
      // here. The cast below bridges to the generic `DatabaseHandle.transaction`
      // signature without losing the runtime behavior tests rely on.
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
      insertStmt,
      selectStmt,
      execCalls,
      get transactionCalls(): number {
        return transactionCalls;
      },
    };
  }

  it('exec forwards to the underlying handle', () => {
    const m = makeMockHandle();
    const db = bindMigrationsDb(m.handle);
    db.exec('CREATE TABLE x (id INT);');
    expect(m.execCalls).toContain('CREATE TABLE x (id INT);');
  });

  it('does not prepare any statement at bind time (lazy preparation)', () => {
    // Regression: eager prepare crashed on a fresh DB because
    // schema_migrations did not exist yet. Statements must be deferred until
    // first use, so the runner's bootstrap CREATE TABLE has time to run.
    const m = makeMockHandle();
    bindMigrationsDb(m.handle);
    expect(m.prepareSpy).not.toHaveBeenCalled();
  });

  it('listAppliedNames returns names from the prepared select', () => {
    const m = makeMockHandle({ selectRows: [{ name: '0001_init' }, { name: '0002_more' }] });
    const db = bindMigrationsDb(m.handle);
    expect(db.listAppliedNames()).toEqual(['0001_init', '0002_more']);
    expect(m.selectStmt.all).toHaveBeenCalledTimes(1);
  });

  it('recordApplied runs the prepared insert with positional params', () => {
    const m = makeMockHandle();
    const db = bindMigrationsDb(m.handle);
    const row: AppliedRow = {
      name: '0001_init',
      applied_at: '2026-05-02T00:00:00.000Z',
      checksum: 'abc',
    };
    db.recordApplied(row);
    expect(m.insertStmt.run).toHaveBeenCalledWith('0001_init', '2026-05-02T00:00:00.000Z', 'abc');
  });

  it('transaction wraps fn via handle.transaction and invokes the wrapped callable', () => {
    const m = makeMockHandle();
    const db = bindMigrationsDb(m.handle);
    let ran = false;
    const result = db.transaction(() => {
      ran = true;
      return 42;
    });
    expect(ran).toBe(true);
    expect(result).toBe(42);
    expect(m.transactionCalls).toBe(1);
  });
});

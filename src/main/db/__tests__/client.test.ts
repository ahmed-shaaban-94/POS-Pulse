import { describe, it, expect, vi } from 'vitest';

import { openDatabase, type DatabaseFactory, type DatabaseHandle } from '../client.js';

/**
 * T037 — failing DB client unit test.
 *
 * R1 mitigation: better-sqlite3's native binary is rebuilt for Electron's
 * Node ABI by the postinstall hook (see package.json). Loading it in Vitest
 * (system Node) would crash with NODE_MODULE_VERSION mismatch. We instead
 * inject a fake DatabaseFactory and assert the wiring; real better-sqlite3
 * behavior is verified by T041's manual Electron smoke.
 */
describe('openDatabase', () => {
  function makeFakeDb(): { db: DatabaseHandle; pragmaCalls: string[] } {
    const pragmaCalls: string[] = [];
    const db: DatabaseHandle = {
      pragma: vi.fn((sql: string) => {
        pragmaCalls.push(sql);
        return [];
      }),
      prepare: vi.fn(),
      exec: vi.fn(),
      transaction: vi.fn(),
      close: vi.fn(),
    };
    return { db, pragmaCalls };
  }

  it('passes the injected dbPath to the database factory', () => {
    const { db } = makeFakeDb();
    const factory: DatabaseFactory = vi.fn(() => db);

    openDatabase('/tmp/test.db', factory);

    expect(factory).toHaveBeenCalledTimes(1);
    expect(factory).toHaveBeenCalledWith('/tmp/test.db');
  });

  it('enables WAL journal mode on the opened connection', () => {
    const { db, pragmaCalls } = makeFakeDb();
    const factory: DatabaseFactory = () => db;

    openDatabase('/tmp/test.db', factory);

    expect(pragmaCalls).toContain('journal_mode = WAL');
  });

  it('enables foreign_keys = ON on the opened connection', () => {
    const { db, pragmaCalls } = makeFakeDb();
    const factory: DatabaseFactory = () => db;

    openDatabase('/tmp/test.db', factory);

    expect(pragmaCalls).toContain('foreign_keys = ON');
  });

  it('returns the same handle the factory produced', () => {
    const { db } = makeFakeDb();
    const factory: DatabaseFactory = () => db;

    const result = openDatabase('/tmp/test.db', factory);

    expect(result).toBe(db);
  });
});

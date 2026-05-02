import { describe, it, expect, vi } from 'vitest';

/**
 * Covers `client.ts`'s `defaultFactory` (the arrow that constructs a real
 * better-sqlite3 instance). We mock the better-sqlite3 module so the factory
 * can run in Vitest without loading the native binding (R1).
 *
 * Lives in its own file because it uses `vi.mock`, which hoists module-wide;
 * keeping it isolated avoids cross-pollination with the main client tests.
 */

const ctorCalls: string[] = [];

class FakeBetterSqlite3 {
  constructor(public readonly dbPath: string) {
    ctorCalls.push(dbPath);
  }
  pragma = vi.fn();
  prepare = vi.fn();
  exec = vi.fn();
  transaction = vi.fn();
  close = vi.fn();
}

vi.mock('better-sqlite3', () => ({
  default: FakeBetterSqlite3,
}));

describe('client defaultFactory', () => {
  it('constructs better-sqlite3 with the dbPath when no factory is injected', async () => {
    const { openDatabase } = await import('../client.js');
    const handle = openDatabase('/tmp/pos.db');

    expect(ctorCalls).toContain('/tmp/pos.db');
    expect(handle).toBeInstanceOf(FakeBetterSqlite3);
  });
});

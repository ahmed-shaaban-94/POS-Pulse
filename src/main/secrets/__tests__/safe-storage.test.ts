import { describe, it, expect, beforeEach, vi } from 'vitest';

import { makeSecretKey, type SecretStore } from '../../../shared/secret-store.js';
import { createInMemorySecretStore } from '../in-memory.js';
import { createSafeStorageSecretStore, type SafeStorageLike } from '../safe-storage.js';
import type { DatabaseHandle } from '../../db/client.js';

/**
 * T043 — SecretStore round-trip + validation tests.
 *
 * Both backends (in-memory + safe-storage) share the same contract, so
 * the suite runs against each via `describeSecretStore`. Real Electron
 * `safeStorage` is replaced with a SafeStorageLike fake (R5) that
 * round-trips strings through Buffer without real DPAPI.
 *
 * No real credentials. All tests use the spec-mandated placeholder pair
 * key="test.placeholder", value="placeholder".
 */

const TEST_KEY = makeSecretKey('test.placeholder');
const TEST_VALUE = 'placeholder';
const TEST_VALUE_2 = 'second-placeholder';

/**
 * Reversible fake of Electron's `safeStorage`. Encrypts by prefixing the
 * UTF-8 bytes with a marker so we can prove encrypt/decrypt was called
 * (rather than the value being stored verbatim). Buffer in / Buffer out
 * matches the real Electron API surface.
 */
function makeFakeSafeStorage(opts: { available?: boolean } = {}): SafeStorageLike {
  const available = opts.available ?? true;
  return {
    isEncryptionAvailable(): boolean {
      return available;
    },
    encryptString(plain: string): Buffer {
      return Buffer.concat([Buffer.from('FAKE:', 'utf8'), Buffer.from(plain, 'utf8')]);
    },
    decryptString(buf: Buffer): string {
      const prefix = Buffer.from('FAKE:', 'utf8');
      if (!buf.subarray(0, prefix.length).equals(prefix)) {
        throw new Error('fake safeStorage: decrypt called on un-encrypted blob');
      }
      return buf.subarray(prefix.length).toString('utf8');
    },
  };
}

/**
 * Minimal fake DatabaseHandle backing the safe-storage SecretStore. Stores
 * rows in a Map; honors INSERT OR REPLACE / SELECT / DELETE for the three
 * SQL strings the backend issues.
 */
function makeFakeDb(): DatabaseHandle {
  const rows = new Map<string, Buffer>();

  type Stmt = { run: (...args: unknown[]) => unknown; get: (...args: unknown[]) => unknown };
  const prepare = vi.fn((sql: string): Stmt => {
    if (/INSERT OR REPLACE INTO secrets/i.test(sql)) {
      return {
        run(key: unknown, value: unknown): unknown {
          rows.set(String(key), value as Buffer);
          return { changes: 1 };
        },
        get(): unknown {
          throw new Error('not callable');
        },
      };
    }
    if (/SELECT value FROM secrets WHERE key/i.test(sql)) {
      return {
        get(key: unknown): unknown {
          const v = rows.get(String(key));
          return v === undefined ? undefined : { value: v };
        },
        run(): unknown {
          throw new Error('not callable');
        },
      };
    }
    if (/DELETE FROM secrets WHERE key/i.test(sql)) {
      return {
        run(key: unknown): unknown {
          rows.delete(String(key));
          return { changes: 1 };
        },
        get(): unknown {
          throw new Error('not callable');
        },
      };
    }
    throw new Error(`fake DB: unexpected SQL: ${sql}`);
  });

  return {
    pragma: vi.fn(),
    prepare,
    exec: vi.fn(),
    transaction: vi.fn(),
    close: vi.fn(),
  };
}

function describeSecretStore(name: string, makeStore: () => SecretStore): void {
  describe(name, () => {
    let store: SecretStore;
    beforeEach(() => {
      store = makeStore();
    });

    it('round-trips set → get → returns value', async () => {
      await store.set(TEST_KEY, TEST_VALUE);
      expect(await store.get(TEST_KEY)).toBe(TEST_VALUE);
    });

    it('overwrites a prior value (last write wins)', async () => {
      await store.set(TEST_KEY, TEST_VALUE);
      await store.set(TEST_KEY, TEST_VALUE_2);
      expect(await store.get(TEST_KEY)).toBe(TEST_VALUE_2);
    });

    it('set → delete → get returns null', async () => {
      await store.set(TEST_KEY, TEST_VALUE);
      await store.delete(TEST_KEY);
      expect(await store.get(TEST_KEY)).toBeNull();
    });

    it('delete on a missing key does not throw (idempotent)', async () => {
      const missing = makeSecretKey('test.missing');
      await expect(store.delete(missing)).resolves.toBeUndefined();
    });

    it('get on a missing key returns null', async () => {
      expect(await store.get(TEST_KEY)).toBeNull();
    });

    it('rejects empty value (callers must delete instead)', async () => {
      await expect(store.set(TEST_KEY, '')).rejects.toThrow(/empty/i);
    });

    it('rejects non-string value at the type-runtime boundary', async () => {
      // A renderer or future caller might pass a non-string; defense-in-depth.
      await expect(
        store.set(TEST_KEY, undefined as unknown as string),
      ).rejects.toThrow();
    });
  });
}

/**
 * SecretKey validation lives in the shared contract, but exercising it
 * here proves callers cannot bypass validation by going through the
 * factory function.
 */
describe('makeSecretKey', () => {
  it.each([
    ['empty string', ''],
    ['whitespace', '   '],
    ['mixed case', 'Test.Placeholder'],
    ['leading digit', '1test.placeholder'],
    ['leading dot', '.test'],
    ['leading dash', '-test'],
    ['contains space', 'test placeholder'],
    ['too long (65)', 'a' + 'a'.repeat(64)],
    ['contains slash', 'test/placeholder'],
    ['contains uppercase mid', 'test.Placeholder'],
  ])('rejects invalid key: %s', (_label, raw) => {
    expect(() => makeSecretKey(raw)).toThrow(/Invalid SecretKey/);
  });

  it.each([
    ['simple lowercase', 'test'],
    ['dotted', 'test.placeholder'],
    ['underscored', 'test_placeholder'],
    ['kebab', 'test-placeholder'],
    ['mixed segments', 'a.b-c_d.0'],
    ['exactly 64 chars', 'a' + 'a'.repeat(63)],
    ['single char', 'a'],
  ])('accepts valid key: %s', (_label, raw) => {
    expect(() => makeSecretKey(raw)).not.toThrow();
  });
});

describeSecretStore('InMemorySecretStore', () => createInMemorySecretStore());

describeSecretStore('SafeStorageSecretStore', () =>
  createSafeStorageSecretStore({
    handle: makeFakeDb(),
    safeStorage: makeFakeSafeStorage(),
  }),
);

/**
 * Backend-specific guarantees beyond the shared contract.
 */
describe('SafeStorageSecretStore — lazy preparation', () => {
  it('does not prepare any statement at construction (mirrors Phase 4 lesson)', () => {
    // Regression: eager prepare crashes on a fresh DB because the
    // `secrets` table does not exist until migration 0002_secrets.sql
    // has been applied. Statements must be deferred until first use.
    // Same lesson as Phase 4's bindMigrationsDb regression.
    const prepareSpy = vi.fn(() => {
      throw new Error('prepare must not be called at construction');
    });
    const handle: DatabaseHandle = {
      pragma: vi.fn(),
      prepare: prepareSpy,
      exec: vi.fn(),
      transaction: vi.fn(),
      close: vi.fn(),
    };
    createSafeStorageSecretStore({ handle, safeStorage: makeFakeSafeStorage() });
    expect(prepareSpy).not.toHaveBeenCalled();
  });
});

describe('SafeStorageSecretStore — encryption guarantees', () => {
  it('persists ciphertext that does not contain the plaintext bytes', async () => {
    const handle = makeFakeDb();
    const safeStorage = makeFakeSafeStorage();
    const store = createSafeStorageSecretStore({ handle, safeStorage });

    await store.set(TEST_KEY, TEST_VALUE);

    // Read the raw stored buffer back through the fake DB's SELECT path.
    const stmt = handle.prepare('SELECT value FROM secrets WHERE key = ?') as {
      get: (key: string) => { value: Buffer } | undefined;
    };
    const row = stmt.get(TEST_KEY);
    expect(row).toBeDefined();
    expect(row?.value).toBeInstanceOf(Buffer);
    // Even with a trivial fake (FAKE: prefix + utf8), the stored bytes are
    // not a verbatim copy of the plaintext — proves encrypt was invoked.
    expect(row?.value.toString('utf8')).not.toBe(TEST_VALUE);
    expect(row?.value.toString('utf8').startsWith('FAKE:')).toBe(true);
  });

  it('isProductionBacked returns true for the safe-storage backend', () => {
    const store = createSafeStorageSecretStore({
      handle: makeFakeDb(),
      safeStorage: makeFakeSafeStorage(),
    });
    expect(store.isProductionBacked()).toBe(true);
  });
});

describe('InMemorySecretStore — backend-specific', () => {
  it('isProductionBacked returns false', () => {
    expect(createInMemorySecretStore().isProductionBacked()).toBe(false);
  });

  it('tolerates a key not present in the underlying map', async () => {
    // Ensures the in-memory backend's get() returns null (not undefined)
    // for missing keys, matching the SafeStorage backend's contract.
    const store = createInMemorySecretStore();
    const key = makeSecretKey('test.never-set');
    expect(await store.get(key)).toBeNull();
  });
});

/**
 * Cross-backend contract assertion: both must agree about the shape of a
 * missing key. This caught a real bug in the in-memory adapter during
 * development where Map.get's `undefined` leaked through unconverted.
 */
describe('contract parity: missing key returns null on every backend', () => {
  const key = makeSecretKey('test.never');
  it('in-memory', async () => {
    expect(await createInMemorySecretStore().get(key)).toBeNull();
  });
  it('safe-storage', async () => {
    expect(
      await createSafeStorageSecretStore({
        handle: makeFakeDb(),
        safeStorage: makeFakeSafeStorage(),
      }).get(key),
    ).toBeNull();
  });
});

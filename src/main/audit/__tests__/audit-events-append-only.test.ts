/**
 * T041 — Integration test: audit_events append-only enforcement.
 *
 * Executes the real `migrations/0004_audit_events.sql` against an in-memory
 * sql.js database (pure-JS SQLite-WASM). Verifies that the BEFORE UPDATE and
 * BEFORE DELETE triggers raise ABORT, and that audit_events_sync_state remains
 * mutable (no append-only constraint on the sibling table).
 *
 * Production uses better-sqlite3 (native ABI); loading it in Vitest (system
 * Node) crashes with NODE_MODULE_VERSION mismatch (R1). sql.js is the
 * unit-test proxy — it IS SQLite proper, so trigger semantics match exactly.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import initSqlJs, { type Database as SqlJsDatabase, type SqlValue } from 'sql.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATION_PATH = path.resolve(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  'migrations',
  '0004_audit_events.sql',
);

async function openInMemoryDb(): Promise<SqlJsDatabase> {
  const SQL = await initSqlJs();
  return new SQL.Database();
}

function readMigrationSql(): string {
  return readFileSync(MIGRATION_PATH, 'utf8');
}

/** Canonical minimal audit event row for use across tests. */
const CANONICAL_ROW = {
  event_id: 'evt-0001',
  tenant_id: 'tenant-A',
  branch_id: 'branch-1',
  originating_terminal_id: 'term-1',
  acting_operator_id: 'clerk-user-1',
  session_id: null,
  shift_id: null,
  action_category: 'shift.open',
  created_at: '2026-05-07T10:00:00.000Z',
  approving_supervisor_id: null,
  payload: null,
};

function insertRow(db: SqlJsDatabase, row = CANONICAL_ROW): void {
  db.run(
    `INSERT INTO audit_events
       (event_id, tenant_id, branch_id, originating_terminal_id, acting_operator_id,
        session_id, shift_id, action_category, created_at, approving_supervisor_id, payload)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.event_id,
      row.tenant_id,
      row.branch_id,
      row.originating_terminal_id,
      row.acting_operator_id,
      row.session_id,
      row.shift_id,
      row.action_category,
      row.created_at,
      row.approving_supervisor_id,
      row.payload,
    ],
  );
}

describe('migration 0004_audit_events — append-only triggers (T041)', () => {
  let db: SqlJsDatabase;

  beforeEach(async () => {
    db = await openInMemoryDb();
    db.run(readMigrationSql());
  });

  afterEach(() => {
    db.close();
  });

  it('migration SQL applies cleanly to a fresh database', () => {
    // If we get here, the beforeEach did not throw — migration is valid.
    const tables = db.exec(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`);
    const names: string[] = tables[0]?.values.flat() as string[];
    expect(names).toContain('audit_events');
    expect(names).toContain('audit_events_sync_state');
  });

  it('INSERT succeeds for a valid row', () => {
    expect(() => {
      insertRow(db);
    }).not.toThrow();
    const result = db.exec(`SELECT COUNT(*) FROM audit_events`);
    expect(result[0]?.values[0]?.[0]).toBe(1);
  });

  it('BEFORE UPDATE trigger raises ABORT — audit_events is immutable', () => {
    insertRow(db);
    expect(() =>
      db.run(`UPDATE audit_events SET action_category = 'shift.close' WHERE event_id = ?`, [
        'evt-0001',
      ]),
    ).toThrow(/audit_events is append-only: UPDATE is denied/i);
  });

  it('BEFORE DELETE trigger raises ABORT — rows cannot be removed', () => {
    insertRow(db);
    expect(() => db.run(`DELETE FROM audit_events WHERE event_id = ?`, ['evt-0001'])).toThrow(
      /audit_events is append-only: DELETE is denied/i,
    );
  });

  it('row count is unchanged after a blocked DELETE attempt', () => {
    insertRow(db);
    try {
      db.run(`DELETE FROM audit_events WHERE event_id = ?`, ['evt-0001']);
    } catch {
      // expected — trigger fires
    }
    const result = db.exec(`SELECT COUNT(*) FROM audit_events`);
    expect(result[0]?.values[0]?.[0]).toBe(1);
  });

  it('composite PK (event_id, tenant_id) blocks a true duplicate', () => {
    insertRow(db);
    expect(() => {
      insertRow(db);
    }).toThrow(/UNIQUE|PRIMARY KEY/i);
  });

  it('same event_id with a different tenant_id is allowed (independent tenant scope)', () => {
    insertRow(db);
    expect(() => {
      insertRow(db, { ...CANONICAL_ROW, tenant_id: 'tenant-B' });
    }).not.toThrow();
    const result = db.exec(`SELECT COUNT(*) FROM audit_events`);
    expect(result[0]?.values[0]?.[0]).toBe(2);
  });

  it('audit_events_sync_state is mutable — UPDATE and DELETE are permitted', () => {
    insertRow(db);
    db.run(
      `INSERT INTO audit_events_sync_state (tenant_id, event_id, synced_at)
       VALUES (?, ?, ?)`,
      ['tenant-A', 'evt-0001', null],
    );

    // UPDATE must not throw
    expect(() =>
      db.run(
        `UPDATE audit_events_sync_state SET synced_at = ? WHERE tenant_id = ? AND event_id = ?`,
        ['2026-05-07T11:00:00.000Z', 'tenant-A', 'evt-0001'],
      ),
    ).not.toThrow();

    // DELETE must not throw
    expect(() =>
      db.run(`DELETE FROM audit_events_sync_state WHERE tenant_id = ? AND event_id = ?`, [
        'tenant-A',
        'evt-0001',
      ]),
    ).not.toThrow();
  });

  it('NOT NULL columns are enforced on audit_events', () => {
    const required = [
      'event_id',
      'tenant_id',
      'branch_id',
      'originating_terminal_id',
      'acting_operator_id',
      'action_category',
      'created_at',
    ] as const;

    for (const col of required) {
      const base: SqlValue[] = [
        `evt-null-${col}`, // event_id
        'tenant-A', // tenant_id
        'branch-1', // branch_id
        'term-1', // originating_terminal_id
        'clerk-1', // acting_operator_id
        null, // session_id
        null, // shift_id
        'shift.open', // action_category
        '2026-05-07T10:00:00.000Z', // created_at
        null, // approving_supervisor_id
        null, // payload
      ];
      const colOrder = [
        'event_id',
        'tenant_id',
        'branch_id',
        'originating_terminal_id',
        'acting_operator_id',
        'session_id',
        'shift_id',
        'action_category',
        'created_at',
        'approving_supervisor_id',
        'payload',
      ];
      const params = base.map((v, i) => (colOrder[i] === col ? null : v));

      expect(
        () =>
          db.run(
            `INSERT INTO audit_events
               (event_id, tenant_id, branch_id, originating_terminal_id, acting_operator_id,
                session_id, shift_id, action_category, created_at, approving_supervisor_id, payload)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            params,
          ),
        `Expected NOT NULL violation for column: ${col}`,
      ).toThrow(/NOT NULL constraint/i);
    }
  });
});

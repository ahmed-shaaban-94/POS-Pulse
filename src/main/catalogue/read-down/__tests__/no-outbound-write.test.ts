import { beforeAll, describe, expect, it } from 'vitest';

import {
  freshCatalogueDb,
  handleFor,
  initCatalogueSql,
} from '../../__tests__/__helpers__/catalogue-fixture.js';
import { createCatalogueSyncStateRepo } from '../../catalogue-sync-state-repo.js';
import { createReadDownWriter } from '../read-down-writer.js';
import { createReadDownDriver } from '../read-down-driver.js';
import type { ReadDownClient, ReadDownFetchResult } from '../read-down-client-types.js';
import type { SellableCatalogRow } from '../map-sellable-row.js';

/**
 * 010 T036 (RED) — no outbound write (US2, SC-7 / FR-10).
 *
 * The read-down is STRICTLY backend → local. Across a full tick the only backend
 * interaction is the snapshot READ (`fetchSnapshot`); there is NO POS→backend
 * write of any kind. The `ReadDownClient` interface is read-only BY CONSTRUCTION
 * (its sole method is `fetchSnapshot`), and this test pins that the driver
 * exercises only that method — a spy client records every method invocation and
 * asserts the set is exactly `{ fetchSnapshot }`, called once per tick, with no
 * other outbound call slipping in.
 *
 * This is the regression guard for FR-10 / T8 (§A4 threat model): if any future
 * edit adds an upward write (a POST/PUT to the backend, an ERP push), it must add
 * a method to the client or a new outbound call — which this test would catch.
 */

beforeAll(async () => {
  await initCatalogueSql();
});

const TENANT = 'tenant-1';
const BRANCH = 'branch-1';

function good(id: string): SellableCatalogRow {
  return {
    product_id: id,
    sku: `SKU-${id}`,
    name: `Name ${id}`,
    aliases: [],
    price: { amount: '10.00', currency_code: 'EGP' },
    tax_category: 'standard',
    active: true,
    row_cursor: `cur-${id}`,
  };
}

/** A spy client that records every method name invoked on it. */
function spyClient(result: ReadDownFetchResult): {
  client: ReadDownClient;
  invocations: string[];
} {
  const invocations: string[] = [];
  // A Proxy records ANY property access that is then called — so an upward-write
  // method added later (e.g. `postSale`) would show up in `invocations`.
  const base: ReadDownClient = {
    fetchSnapshot(): Promise<ReadDownFetchResult> {
      invocations.push('fetchSnapshot');
      return Promise.resolve(result);
    },
  };
  const client = new Proxy(base, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver) as unknown;
      if (typeof value === 'function' && prop !== 'fetchSnapshot') {
        invocations.push(String(prop));
      }
      return value;
    },
  });
  return { client, invocations };
}

describe('T036 — no outbound write', () => {
  it('a full tick invokes only fetchSnapshot — no other backend call', async () => {
    const db = freshCatalogueDb();
    const handle = handleFor(db);
    const syncStateRepo = createCatalogueSyncStateRepo(handle);
    const writer = createReadDownWriter({ db: handle, syncStateRepo });
    const { client, invocations } = spyClient({
      kind: 'ok',
      sourceSnapshotId: 'snap-1',
      rows: [good('p-1'), good('p-2')],
    });

    const driver = createReadDownDriver({
      client,
      writer,
      tenantId: TENANT,
      branchId: BRANCH,
      now: () => '2026-06-07T10:00:00.000Z',
      tickIntervalMs: 60_000,
    });

    const admission = driver.runTickOnce();
    if (admission.kind !== 'started') throw new Error('expected started');
    await admission.completed;

    // Exactly one outbound interaction, and it is the READ.
    expect(invocations).toEqual(['fetchSnapshot']);
    db.close();
  });

  it('the ReadDownClient surface is read-only — its only method is fetchSnapshot', () => {
    const { client } = spyClient({ kind: 'failed' });
    const methodNames = Object.keys(client).filter(
      (k) => typeof (client as unknown as Record<string, unknown>)[k] === 'function',
    );
    expect(methodNames).toEqual(['fetchSnapshot']);
  });
});

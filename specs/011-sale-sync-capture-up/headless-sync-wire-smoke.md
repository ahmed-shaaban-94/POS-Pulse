# Headless Sale-Sync Wire Smoke — POS-SYNC-LAB-001

**Goal.** Prove the one question without the React GUI:

> Can a valid finalized sale envelope enter the **production** outbox/drain path and
> reach Data-Pulse successfully without GUI involvement?

**Verdict: ✅ Headless sync core proven.**

## What it exercises (production modules, not a parallel impl)

The smoke (`src/main/sales-sync/__tests__/sync-wire.headless.test.ts`) wires the SAME
composition the main process boots in `src/main/index.ts` (~L1314–1369):

| Stage | Production module under test |
|:--|:--|
| sale/envelope creation | `sales` durable row (fixtured; 008 finalize is the real writer in prod) |
| outbox insertion | `bindSaleSyncOutboxRepository().insert` (real enqueue path) |
| drain execution | `createSaleSyncEngine` → `runTickOnce()` (FIFO, single-flight, FR-3 gate) |
| payload + auth + HTTP | `createSaleSyncClient` (the **live** client: `buildCapturePayload` → `toWireBody` → `Authorization: Bearer <envelope>` + `Idempotency-Key` → `classifyStatus`) |
| ack/retry/dead-letter | `createSaleSyncStateRepo` (synced / pending+backoff / dead_letter) |

The **only** seam replaced is `fetch` — the network boundary — using the repo's
existing capture-fetch pattern (`create-sale-sync-client.test.ts`). The existing
`sale-sync-engine.test.ts` drives the engine against the `createFakeSaleSyncClient`
DI fake; this harness instead wires the **real** HTTP client, so the production
payload-transform + auth-header + classifier + drain + persistence chain runs
end-to-end. The DB is sql.js with the full migration stack (no native binding needed).

## GUI / trust-boundary isolation

- The engine is driven directly via `engine.runTickOnce()` — the same call the main
  interval makes (`index.ts` L1362). **No `ipcMain`, no preload, no renderer** in the loop.
- `getOperatorToken` is read **in-process** (mirroring the `operatorEnvelopeHolder.get(...)`
  closures at the composition root) and is never bridged.
- GUI/renderer wiring is therefore **isolated and NOT exercised** by this smoke — only the
  headless sync core is proven. No trust-boundary logic was moved into renderer/test shortcuts.

## Evidence captured (assertions, non-secret)

| Field | Happy-path value |
|:--|:--|
| `sale_id` | `sale-headless-1` |
| `outbox_id` | `ob-sale-headless-1` (read back via the production repo) |
| `terminal_id` | `term-1` (consistent sale ↔ outbox) |
| operator/session present | `true` — proven on the wire (`Authorization: Bearer <envelope>`) |
| `external_id` / `Idempotency-Key` | `pos-pulse:handoff-sale-headless-1` (deterministic) |
| request body shape | `sourceSystem`/`externalId`/`currencyCode`/`posTotal` (`"15.00"`, no float) / `lines[]`; **no tender** |
| request body secret check | envelope token asserted **absent** from the body; only a `sha256` of the body is recorded |
| HTTP status → classification | 201 → ok; 503 → transient (retry); reject → no_connection; 400 → permanent |
| final sync state | `synced` (happy), `pending`+backoff (transient/no_connection), `dead_letter` (permanent) |

## Negative gate (FR-3, enforced by production code)

With an absent operator envelope (`null` **and** `''`), the drain pauses: **no POST**, no
state row written, the sale stays eligible. The gate was not weakened to make the smoke pass.

## Commands run

```bash
node_modules/.bin/vitest run src/main/sales-sync/__tests__/sync-wire.headless.test.ts   # 6 passed
node_modules/.bin/vitest run src/main/sales-sync                                         # 80 passed (9 files)
npm run typecheck                                                                        # clean
eslint <file>  /  prettier --check <file>                                                # clean
```

> `npm install`'s `postinstall` (electron-rebuild of native better-sqlite3/argon2) fails in
> the sandbox (no Electron-headers download). It is irrelevant here: the smoke runs on
> pure-WASM sql.js. No live Data-Pulse endpoint is contacted — `fetch` is mocked at the seam.

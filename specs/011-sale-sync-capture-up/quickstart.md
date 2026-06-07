# Quickstart — Sale Sync (Capture-UP)

Developer path to build + test 011 **now**, before the backend deploy (#349 / HTTP 521).

## Prerequisites

- `npm install`
- Branch `011-sale-sync-capture-up`.
- 008 merged (provides `sale_sync_outbox` + durable Sale records).

## The DI fake is the whole story pre-deploy

The live HTTP client is gated on #349. Everything else is exercised against an injected
`SaleSyncClient` fake that returns a scripted `SaleSyncResult`. No live endpoint needed (FR-13/SC-7).

```ts
const fake: SaleSyncClient = {
  postSale: async () => ({ kind: 'ok' }),   // or 'duplicate' | 'transient' | 'permanent' | 'no_connection'
};
const engine = createSaleSyncEngine({
  client: fake,
  stateRepo,          // sale_sync_state repo (tenant-scoped)
  outboxRepo,         // 008's read-only outbox repo
  saleRepo,           // durable Sale read for payload
  tenantId, branchId, // device-principal scope (from pairingStore at the composition root)
  getOperatorToken,   // in-process read of 004's session token; returns null when no session
  now: () => '2026-06-07T00:00:00.000Z',
  backoff: { baseMs: 1000, maxMs: 300000 },
});
const outcome = engine.runTickOnce();   // single-flight admission
```

## Test matrix to cover (Vitest, test-first)

| Scenario | Fake returns | Expected |
|:--|:--|:--|
| Happy path | `ok` | `sale_sync_state` → `synced`, `synced_at` set |
| Already captured | `duplicate` (409) | → `synced`, no retry |
| Transient | `transient` | stays `pending`, `attempt_count++`, `next_retry_at` set; persists across a simulated restart |
| Permanent | `permanent` (4xx) | → `dead_letter`, operator notification emitted |
| Offline | `no_connection` | stays `pending`, no count loss |
| No operator session | (engine guard) | drain pauses; resumes when `getOperatorToken` returns a token |
| FIFO | mixed | sales drained in `enqueued_at` order |
| No-tender boundary | n/a | serialised payload has zero tender fields |
| Money | n/a | all amounts integer minor units; no float coercion |
| Tenant scope | n/a | a tenant-B row is never selected/written by a tenant-A drain |

## Run

```bash
npm run typecheck
npm run lint
npm test -- sales-sync          # the 011 suite
npm test -- --coverage          # ≥95% on the payload/money path
```

## What is BLOCKED (do not attempt pre-#349)

- `create-sale-sync-client` real HTTP calls (backend is HTTP 521).
- Composition-root wiring of the live client + interval trigger.
- The §A5 no-tender end-to-end verification (needs a live backend + Connector).

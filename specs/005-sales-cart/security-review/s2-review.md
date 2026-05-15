<!--
  specs/005-sales-cart/security-review/s2-review.md
  S2 post-implementation security review — Sales Cart (feature 005)
  Reviewer: Security Review Agent (Sonnet 4.6)
  Scope: T030–T054, PRs #153 + #154, merged on main at a4830e5
-->

# 005-Sales-Cart S2 Security Review

## 1. Metadata

| Field            | Value                                                   |
| :--------------- | :------------------------------------------------------ |
| Feature          | 005-sales-cart                                          |
| Slice            | S2 — durable core + live-lines renderer                 |
| Review date      | 2026-05-15                                              |
| Reviewer         | Security Review Agent (automated, Sonnet 4.6)           |
| Branch reviewed  | `docs/005-s2-security-review` (checked out from main)   |
| Base SHA         | `a4830e5` (merge of PR #154 onto main)                  |
| Task range       | T030–T054                                               |
| Verdict          | **CLEARED**                                             |

---

## 2. PRs Reviewed

### PR #153 — feat: add durable sales cart core (merged as `a50e3c5`)

Key commits reviewed:

- `a50e3c5` — feat(pos): add durable sales cart core
- `14955d2` — docs(pos): clear A2 migration review gate for sales cart S2
- `c593295` — Merge pull request #152 (A2 migration review docs)

Files introduced / substantially modified:

- `src/main/cart/cart-bridge.ts` (775 lines) — `CartBridgeHandlers` class, all IPC handlers
- `src/main/cart/cart-store.ts` — SQLite persistence layer (`bindCartStore`)
- `src/main/cart/line-subtotal.ts` — `computeLineSubtotal` pure function
- `src/main/cart/resolve-item-ref.ts` — R7 seam fixture (tests only)
- `src/main/logging/logger.ts` — `CART_REDACTED_KEYS` merged into `ALL_REDACTED_KEYS`
- `migrations/0008_carts.sql` through `migrations/0011_cart_line_discount_placeholders.sql`
- `tests/unit/main/cart/line-subtotal.test.ts` (T030)
- `tests/unit/main/cart/cart-lines-mutations.test.ts` (T031–T035)
- `tests/integration/main/cart/cart-action-outbox-append-only.test.ts` (T036)
- `tests/integration/main/cart/cart-action-outbox-idempotency.test.ts` (T037)
- `tests/integration/main/cart/cart-tenant-isolation.test.ts` (T039)
- `tests/integration/cross-process-redaction-cart-payload-json.test.ts` (T054)

### PR #154 — feat: complete sales cart live lines (merged as `a4830e5`)

Key commits reviewed:

- `9bcbe41` — feat: complete sales cart live lines
- `6b8ce0e` — fix: live-line UI
- `99f420d` / `4310a63` — format and lint fixes
- `e4ccc0f` — test coverage additions
- `1c5d1ba` — lint fix
- `b555a01` — fix: v8 ignore annotations
- `a5bb44e` — test: multi-line bridge branches

Files introduced / substantially modified:

- `src/renderer/ui/cart/CartPane.tsx` (344 lines)
- `src/renderer/ui/cart/LineItemRow.tsx` (119 lines)
- `src/renderer/ui/cart/QuantityStepper.tsx` (83 lines)
- `src/renderer/ui/cart/LineNotePopover.tsx` (106 lines)
- `src/shared/cart/bridge-types.ts` (145 lines)
- `tests/unit/renderer/ui/cart/cart-pane-live-lines.test.tsx` (T052)

---

## 3. Scope

### Covered

- `src/main/cart/` — all main-process cart modules
- `src/renderer/ui/cart/` — all renderer cart components
- `src/shared/cart/bridge-types.ts` — shared request/response types
- `src/main/logging/logger.ts` — redaction configuration
- `migrations/0008_carts.sql` – `migrations/0011_cart_line_discount_placeholders.sql`
- Tests T030–T054 as enumerated in `specs/005-sales-cart/tasks.md`
- Production wiring in `src/main/index.ts` (resolver injection check)

### Explicitly Excluded

- S3 deliverables: `auditEmitter` wiring and audit event emission — blocked on §A3
- S4 deliverables: `cart.handoff` full implementation and `PaymentIntentEnvelope` production
  construction — blocked on §A4
- `cart.void`, `cart.discountPlaceholders.add/remove` — legitimately stubbed in S2 via
  `gateMutatingS2`; not in scope until a future slice
- Backend API integration (live `resolveItemRef` network call) — out of scope for offline S2
- Backend sync / outbox flush — not implemented in S2; no IPC exposed

---

## 4. Security Matrix

| ID    | Control                              | Finding | Evidence                                      |
| :---- | :----------------------------------- | :------ | :-------------------------------------------- |
| AD-1  | `requireOperatorSession` first       | PASS    | All 10 handlers; `gateMutatingS2` also gates  |
| AD-2  | Tenant isolation enforced            | PASS    | `cart.tenant_id` vs session; T039             |
| AD-3  | Role check (cashier/manager)         | PASS    | `requireOperatorSession` enforces role        |
| OC-1  | Optimistic concurrency on mutations  | PASS    | `version` check before every line mutation    |
| OC-2  | `stale_version` refused generically  | PASS    | No factor-distinguishing detail in response   |
| ID-1  | Idempotency outbox uniqueness        | PASS    | `action_id` UNIQUE; T037 verifies 1 row       |
| ID-2  | Payload mismatch detection           | PASS    | `idempotency_payload_mismatch`; T037          |
| NI-1  | Note length cap (200)                | PASS    | `NOTE_MAX_LENGTH = 200`; bridge enforces      |
| NI-2  | Note forbidden-pattern rejection     | PASS    | `FORBIDDEN_NOTE_PATTERNS`; 3 regex classes    |
| NI-3  | Note content never in payload_json   | PASS    | `note_length` only; T054 verifies             |
| PR-1  | Pino redaction covers cart keys      | PASS    | `CART_REDACTED_KEYS`; 4-depth wildcard        |
| PR-2  | Generic refusals (no leakage)        | PASS    | `{ kind, reason }` only; T039 shape check     |
| RE-1  | No secrets in bridge response types  | PASS    | `bridge-types.ts` reviewed; none found        |
| RE-2  | No PII in renderer state             | PASS    | `CartPane` state: IDs, display strings, ints  |
| AO-1  | Outbox append-only SQL triggers      | PASS    | Trigger pair; T036 verifies UPDATE/DELETE     |
| AE-1  | No audit emission in S2              | PASS    | Zero `auditEmitter` hits in `src/main/cart/`  |
| R7-1  | Fixture resolver not in production   | PASS    | `src/main/index.ts` has no resolver injection |
| ST-1  | Stubs return `not_implemented`       | PASS    | `gateMutatingS2`; still gates on session      |
| MN-1  | Money: integer minor units only      | PASS    | `computeLineSubtotal`; `isSafeInteger` guard  |
| MN-2  | Subtotal overflow refused            | PASS    | `LineSubtotalError` on overflow; T030         |
| MN-3  | Error messages do not echo values    | PASS    | Generic messages; T030 asserts no echo        |

---

## 5. File-by-File Security Walk

### `src/main/cart/cart-bridge.ts`

**Auth gate (AD-1):** `requireOperatorSession` is the first expression in every public handler
(`create`, `linesAdd`, `linesRemove`, `linesUpdateNote`, `linesUpdateQuantity`,
`discountPlaceholdersAdd`, `discountPlaceholdersRemove`, `void`, `handoff`, `resolveItemRef`).
The `gateMutatingS2` helper — used for the four not-yet-implemented mutations — calls
`requireOperatorSession` before returning `{ kind: 'not_implemented' }`, so the auth gate
cannot be bypassed by targeting a stub.

**Tenant isolation (AD-2):** `linesAdd` and all other cart-scoped handlers fetch the cart from
the store and compare `cart.tenant_id` to `session.tenant_id`. Mismatch returns
`{ kind: 'refused', reason: 'tenant_isolation' }` with no additional fields.

**Idempotency (ID-1, ID-2):** The three-step idempotency protocol is:

1. Lookup `cart_action_outbox` by `action_id` (`= idempotency_key`).
2. If found: replay stored outcome (same `action_kind`) or refuse with
   `idempotency_payload_mismatch` (different `action_kind`).
3. If not found: apply the mutation and INSERT the outbox row atomically.

The `action_id` column has a SQL `UNIQUE` constraint. The payload mismatch check is
action-kind–aware; a key previously used for `linesAdd` cannot be reused for `create`.

**Note input validation (NI-1, NI-2, NI-3):**

- Length cap: `req.note.length > NOTE_MAX_LENGTH (200)` → `{ kind: 'refused', reason: 'note_too_long' }`.
- Forbidden patterns (`FORBIDDEN_NOTE_PATTERNS`): three regex classes covering PIN/password/token
  keywords, bare card-number-shaped sequences (13–19 digits), and PEM key headers. Match →
  `{ kind: 'refused', reason: 'note_content_refused' }`.
- Payload serialization: `payload_json: JSON.stringify({ note_length: req.note?.length ?? 0 })`.
  Note content is **never** written to the outbox.

**`FORBIDDEN_PAYLOAD_FIELD_NAMES`:** A `ReadonlySet<string>` of 12 sensitive field names
(`pin`, `pin_hash`, `password`, `password_hash`, `clerk_jwt`, `clerk_session_token`,
`device_token`, `device_token_attestation`, `pairing_code`, `token`, `secret`, `credential`).
`scrubPayloadForOutbox` strips any matching key from the object before serialization. Applied
to all outbox writes.

**Stubs (ST-1):** `cart.void`, `cart.handoff`, `cart.discountPlaceholders.add/remove` are gated
by `gateMutatingS2` which: (a) calls `requireOperatorSession` first, (b) returns
`{ kind: 'not_implemented' }`. No business logic, no DB writes, no data exposed.

**Optimistic concurrency (OC-1, OC-2):** Every mutating handler that targets a `cart_line` row
passes the caller-supplied `version` to the store. The store performs
`UPDATE cart_lines SET ... WHERE id = ? AND version = ?` and checks `changes === 1`. Zero
changes → `{ kind: 'refused', reason: 'stale_version' }`. The refusal carries no
factor-distinguishing detail.

**Replay shape (linesAdd):** The idempotency replay path returns the full ok shape including
`display_name`, `unit_price_minor`, `line_subtotal_minor`, `quantity`, and `version`. These are
data the renderer already displayed on the first call; no additional secrets are exposed by
replaying them.

### `src/main/cart/line-subtotal.ts`

`computeLineSubtotal(quantity, unit_price_minor)` enforces:

1. Both arguments must be integers (`Number.isInteger`).
2. `quantity` must be strictly positive.
3. `unit_price_minor` must be non-negative.
4. Product must satisfy `Number.isSafeInteger`.

On any violation a `LineSubtotalError` is thrown. Error messages are static strings that do
**not** echo the offending numeric value (verified by T030 `expect(msg).not.toContain('-1')`).
This satisfies P1/NFR-002 (no floats, no BigInt, overflow refused).

### `src/main/cart/resolve-item-ref.ts`

The fixture resolver (`fixtureResolver` / `resolveFixtureItemRef`) is present in the module
but is **never injected in production**. `src/main/index.ts` contains no reference to
`resolveItemRef`, `FIXTURE`, or `resolve-item-ref`. The `DEFAULT_ITEM_REF_RESOLVER` used by
`CartBridgeHandlers` when no explicit resolver is supplied refuses generically:

```typescript
const DEFAULT_ITEM_REF_RESOLVER: ItemRefResolver = () =>
  Promise.resolve({ kind: 'refused', reason: 'not_configured' });
```

The fixture is test-only injection via the `resolveItemRef` constructor option.

### `src/main/logging/logger.ts`

`CART_REDACTED_KEYS = ['note', 'attribution_operator_id', 'payload_json']` is merged into
`ALL_REDACTED_KEYS` alongside the PAIRING and OPERATOR redaction sets. Pino applies the
combined key list at four wildcard depths: `key`, `*.key`, `*.*.key`, `*.*.*.key`. The T054
integration test verifies that `payload_json` is replaced by `[Redacted]` at all four nesting
levels while `cart_id` and `action_kind` remain visible.

### `src/shared/cart/bridge-types.ts`

All types are `readonly`. The `CartLinesAddResponse` ok-branch surface includes:
`line_id`, `version`, `display_name`, `unit_price_minor`, `line_subtotal_minor`, `quantity`.

None of these fields carry authentication material. No JWT, device token, PIN, password hash,
or session credential appears in any exported type. The `version` field is a monotonic integer
(not a secret nonce). `display_name` is a product label. `unit_price_minor` and
`line_subtotal_minor` are integer minor-unit amounts appropriate for display.

### `src/renderer/ui/cart/CartPane.tsx`

**Bridge acquisition:** `getBridge()` returns `_testBridge ?? readCartBridge()`. The Electron
`readCartBridge()` arm is marked `/* v8 ignore next */`; the test injection prop
`_testBridge` is the only path exercised in tests.

**Session guard:** The component renders `null` when `session === null` (signed out). Defensive
`activeCart === null` guards before every bridge call are marked `/* v8 ignore next */` and
are unreachable under normal flow (component conditionally renders below the session/cart
null checks).

**Renderer state:** `useState<CartLineItem[]>` holds opaque `id`, display strings, and
integer minor-unit amounts. No JWT, token, or hash is stored in component state.

**Error surfacing:** Note validation failures are surfaced as generic "Note rejected" text.
The specific refusal reason from the bridge is not displayed to the user.

### `src/renderer/ui/cart/LineNotePopover.tsx`

`<textarea maxLength={NOTE_MAX_LENGTH} />` provides a UX-layer 200-char cap. This is a
convenience only; the authoritative cap is enforced by the bridge. Note content is never
logged in the renderer.

### `src/renderer/ui/cart/LineItemRow.tsx`

Notes are rendered via `truncateNote(note)` (40-char truncation for display). The truncated
string is display-only and is not re-sent to the bridge on subsequent operations.

### `src/renderer/ui/cart/QuantityStepper.tsx`

Minimum touch targets are `MIN_TOUCH × MIN_TOUCH` CSS px (from `touchTarget.min`).
Decrement-to-zero routes to `onRemoveRequest()` when the line has no note, or `onDecrement()`
(parent shows a confirmation dialog) when a note is present. No security-relevant logic.

---

## 6. Renderer Exposure Statement

The IPC surface exposed to the renderer through the preload bridge for the cart feature is
bounded by the types in `src/shared/cart/bridge-types.ts`. The following categories of data
**are** exposed:

- Opaque identifiers (`cart_id`, `line_id`) — safe; no entropy leakage
- `version` (monotonic integer) — safe; not a secret
- `display_name` (product label string) — safe
- `unit_price_minor`, `line_subtotal_minor`, `quantity` (integer minor units) — safe
- `reason` strings (`tenant_isolation`, `stale_version`, `note_too_long`, etc.) — generic;
  no factor-distinguishing detail

The following categories are **not** present in any response type:

- JWT / Clerk session tokens
- Device token or device token attestation
- PIN or PIN hash
- Password or password hash
- Pairing code
- Operator credential material
- Raw `payload_json` outbox content
- Note text content (only `note_length` integer at the outbox layer)

**`contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`** remain in force from
the 001-foundation baseline. The cart feature adds no `BrowserWindow` instances and therefore
introduces no new Electron boundary surface.

---

## 7. Logging and Redaction Statement

### Pino redaction coverage

`ALL_REDACTED_KEYS` is the union of three sets:

| Set              | Keys included                                                          |
| :--------------- | :--------------------------------------------------------------------- |
| PAIRING          | `device_token`, `device_token_attestation`, `pairing_code`, etc.       |
| OPERATOR         | `pin`, `pin_hash`, `clerk_jwt`, `clerk_session_token`, etc.            |
| CART             | `note`, `attribution_operator_id`, `payload_json`                      |

Redaction is applied at four depths: `key`, `*.key`, `*.*.key`, `*.*.*.key`. This covers
all plausible nesting of log arguments.

### What is redacted for the cart

- **`note`** — note text never appears in logs (field is replaced by `[Redacted]`)
- **`attribution_operator_id`** — operator identity within discount attribution not logged
- **`payload_json`** — raw outbox payload bytes never appear in logs

### What is not redacted (by design)

- `cart_id`, `line_id` — opaque UUIDs; logging aids debugging without PII exposure
- `action_kind` — action type string; safe to log
- `version` — monotonic integer
- `quantity`, `unit_price_minor`, `line_subtotal_minor` — non-sensitive operational data

### T054 coverage

`tests/integration/cross-process-redaction-cart-payload-json.test.ts` (T054) verifies that a
Pino logger configured with `ALL_REDACTED_KEYS` replaces `payload_json` at all four nesting
depths while leaving `cart_id` and `action_kind` intact. This gives direct regression
protection for the redaction configuration.

---

## 8. Remaining Risks and Gates

### Open risks (accepted for S2)

**R7-SEAM (LOW):** The fixture item-ref resolver (`resolve-item-ref.ts`) ships in the compiled
bundle. It is not injected in production (`src/main/index.ts` verified). However, if a future
developer wires it incorrectly, the 5 fixture SKUs with fixed prices would be used instead of
the production resolver. Mitigation: a future task should add a production startup assertion
or remove the fixture from the production bundle (tree-shake / move to `__tests__/helpers`).
Accepted for S2 because the production code path is verified clean.

**R-HANDOFF-STUB (LOW):** `cart.handoff` returns `not_implemented`. The `PaymentIntentEnvelope`
construction is not implemented. This is correct S2 posture; no sensitive payment data is
constructed or exposed. Risk materializes in S4 when the real implementation is added — the
S4 security review must re-examine this handler end-to-end.

**R-AUDIT-STUB (LOW):** Audit emission (`auditEmitter`) is not wired in S2. The four action
kinds requiring audit events (`linesAdd`, `linesRemove`, `linesUpdateNote`, `linesUpdateQuantity`)
silently succeed without audit trail. This is an accepted gap for S2; §A3 clearance is a hard
gate before S3 proceeds.

### Mandatory gates before next slice

| Gate | Condition                                                                       |
| :--- | :------------------------------------------------------------------------------ |
| §A3  | `auditEmitter` wired for the four cart mutation action kinds; S3 security review|
| §A4  | `cart.handoff` fully implemented with `PaymentIntentEnvelope`; S4 security review|

Neither §A3 nor §A4 is cleared by this review. This document clears the S2 post-implementation
gate only.

---

## 9. Final Verdict

**S2 SECURITY REVIEW CLEARED — S3 may proceed only after §A3 is cleared.**

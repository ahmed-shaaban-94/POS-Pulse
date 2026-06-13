<!--
019-cashier-pin-provisioning — §A4 P8 bridge-security review for the new
operator.provisionCashierPin channel (tasks.md T032). Post-implementation walk
with code-line evidence (the handler is written + tested), per the 010 §A4
template (specs/010-.../security-review/s4-review.md) and the 004 operator-bridge
baseline (specs/004-operator-session/security-review/s1-review.md).
-->

# §A4 — P8 Bridge-Security Review (019-cashier-pin-provisioning)

## 1. Metadata

| Field | Value |
| :--- | :--- |
| Feature | 019-cashier-pin-provisioning |
| Gate | §A4 — P8 Electron security boundary (preload-bridge expansion) |
| Task gated | T032 — the new `operator.provisionCashierPin` channel |
| Bridge surface | `operator.provisionCashierPin` (channel `operator:provision-cashier-pin`) — one method added to the existing 004-owned `operator.*` namespace |
| Review type | **POST-implementation walk.** The handler + IPC wiring + tests are written and green; this re-runs the required-controls matrix against the actual diff and renders a verdict (contrast 010's pre-implementation conditional — that code was unwritten). |
| Prepared by | implementing agent (Claude Code), 2026-06-13 |
| Base / branch | `feat/019-provisioning-impl` (commits `73aae55` contract layer → `da7e6c7` impl) |
| Constitution version pinned | v1.5.1 |
| Verdict | **CLEARED (caveated).** All 12 required controls observed in code; two residuals carried (R-NFR1-TXN, R-DP2-LIVE) — neither re-opens the bridge boundary. See §9. |

> This is the §A4 companion to 004's `security-review/s1-review.md` (the operator-bridge baseline 019
> inherits) and 016's `security-review/s-d5d7-review.md` (the most recent operator-bridge re-check),
> applied to 019's single new channel. Because `provisionCashierPin` mirrors the long-reviewed
> `resetCashierPin` shape almost exactly, this review is mostly a **delta**: it confirms the new method
> preserves every invariant the reset path already cleared, and scrutinizes the **one genuinely new thing**
> — the roster lookup that resolves the provider-neutral `target_user_id` to the cashier's Clerk id.

---

## 2. Inputs reviewed (authoritative sources)

| Source | What it pins |
| :--- | :--- |
| [contracts/provision-cashier-pin.md](../contracts/provision-cashier-pin.md) | The channel, its request `{event_id, target_user_id, initial_pin}`, the response union, the 4 refusal categories, and the 5 invariants verified before success. |
| [plan.md](../plan.md) §Constitution-check (P7/P8/VII/VIII) | P7 secret-free, P8 bridge boundary, VII trusted-enrichment, VIII born-neutral. |
| [spec.md](../spec.md) FR-4 / FR-5 / FR-6 / FR-9 / FR-11 | Role-gate, create-only, PIN never off-device, scope from pairing, `not_ready` no-fallback. |
| `src/main/operator/pin-management.ts` (`provisionCashierPin`) | The as-built handler — the code under review. |
| `src/main/ipc/operator.ts` (`asProvisionCashierPinRequest` + the `PROVISION_CASHIER_PIN` handler) | The as-built IPC boundary validator + delegation + catch. |
| `src/shared/bridge-api.ts` (`ProvisionCashierPinRequest`/`Response`) | The typed wire shape. |
| 004 `security-review/s1-review.md` + `s1-redaction-evidence.md` | The operator-bridge baseline: `requireRole` first, generic-refusal (NFR-003/PR-2), redaction posture this expansion inherits. |

---

## 3. Scope

### Covered by this gate

- `operator.provisionCashierPin` — the manager/admin-invokable first-PIN create channel
  (request `{event_id, target_user_id, initial_pin}` → `pin_provisioned` | `OperatorRefusal`).
- Its IPC boundary validator `asProvisionCashierPinRequest` + the `PROVISION_CASHIER_PIN` handler
  (validate → delegate → catch) in `src/main/ipc/operator.ts`.
- The preload/channel-constant surface registering the channel (`OPERATOR_IPC_CHANNELS.PROVISION_CASHIER_PIN`).

### Explicitly excluded (reviewed under other gates / inherited)

- The `cashier_pin_records` row write + the `0035` additive `user_id` column + the create-only/seal SQL —
  data-layer concerns reviewed at the migration/data level (T004/T005; the column is additive nullable
  non-key, no PK change in 019).
- The Argon2id hash + DPAPI seal mechanism (`pin-credential.ts`, `pin-seal.ts`) — 004-owned, **unchanged by
  019** (FR-8; asserted by the T024 verifier-untouched guard). The verifier never keys on identity.
- The held DP-2 roster `user_id` field transport — upstream (017 OUTBOX); the bridge never sees a backend
  token (the roster fetch's device auth stays main-process, see SEC-1 / AD-4 below).
- Production readiness / rollback — §A5 (rollout-time).

---

## 4. Required-Controls Matrix (observed in the as-built diff)

Each control is a PASS condition; the Evidence column cites the **as-built code** (the handler is written).

| ID | Control | Required state | As-built evidence |
| :--- | :--- | :--- | :--- |
| AD-1 | **Role-gate is the FIRST executable check** | `requireRole(['manager','admin'], session)` runs before any validation, DB read, roster fetch, or write; a refusal short-circuits | `pin-management.ts` `provisionCashierPin` — first statement is `requireRole(...)` inside try/catch, mirroring `resetCashierPin`. Cashier → `role_mismatch`, no row (test `T015`). |
| AD-2 | **Generic refusal** — one closed-set category per failure, no factor-distinguishing detail | response is `{kind:'refused', category}` with `category ∈ {role_mismatch, not_ready, state_invalid, invalid_input, no_connection}`; rejected values never echoed | contract Refusal table; handler returns the sentinels `REFUSE_*`; the IPC catch returns generic `invalid_input`. Tests assert each category + that the rejected PIN/value never appears. |
| SEC-1 | **No secret crosses the bridge upward, is logged, or is returned** (P7/FR-6) | the plaintext `initial_pin` is consumed by `hashPin` and never persisted as plaintext, never logged, never in the response; no hash/salt in the response | `initial_pin` flows only into `hashPin()` → `sealPinMaterial()`; the response is `{kind:'pin_provisioned', audit_event_id}` only. Tests assert the PIN string + `pin_hash`/`pin_salt` appear in no log, audit payload, or response (`T014` secret-free audit). |
| INP-1 | **Input validation at the boundary — minimal trust** | `asProvisionCashierPinRequest` rejects non-objects + missing/empty/wrong-type `event_id`/`target_user_id`/`initial_pin` → `null` → `invalid_input`; PIN shape (`^\d{4,6}$`) validated main-side | `ipc/operator.ts` `asProvisionCashierPinRequest` (string + non-empty guards); handler re-validates `isValidPin`. IPC tests cover non-object + each malformed field; handler test covers bad PIN shape (`T018`). |
| VII-1 | **Scope is trusted-enrichment, never from the renderer** | `tenant_id`/`branch_id`/`terminal_id` come from `pairingStore.getStatus()`, never the request; unpaired → `invalid_input` | handler reads scope from `pairingStore.getStatus()`; the request carries NO scope fields (only `event_id`/`target_user_id`/`initial_pin`). Unpaired terminal → `invalid_input`, no row (test `T018` unpaired). |
| WR-1 | **Create-only — no overwrite / no duplicate** | an existing row (born-neutral OR legacy clerk-keyed) → `state_invalid`; the existing secret is never replaced; no second row | handler's existence guard `WHERE … AND (user_id = ? OR cashier_clerk_user_id = ?)` → `REFUSE_STATE_INVALID`. Tests assert the seeded hash is intact + row count stays 1 for both the neutral and legacy cases (`T016` ×2). |
| ID-1 | **`not_ready` never falls back to a provider-coupled key** (FR-11) | a cashier with no roster `user_id` → `not_ready`, no row, no clerk-keyed fallback | handler resolves `roster.cashiers.find(c => c.user_id === target_user_id)`; `undefined` → `REFUSE_NOT_READY`. No code path writes a row when the neutral key is absent (tests `T017` ×2). |
| RES-1 | **Roster resolution stays main-side; the neutral↔clerk mapping never crosses the bridge** | the handler resolves `target_user_id → clerk id` via `backend.listRoster` in-process; the renderer never receives the mapping | the resolution uses the injected `BackendClient` main-side; the renderer-facing `BranchRosterCashier` deliberately does NOT carry `user_id` (the widened field is on the main-only `BackendRosterCashier`). Minimum-disclosure (Constitution VII). |
| IPC-1 | **Handler never throws across the bridge** | a DB/roster/seal fault degrades to a typed refusal, never an error string or stack to the renderer | `ipc/operator.ts` wraps `pinManagementHandler.provisionCashierPin(req)` in try/catch → generic `invalid_input`. IPC test asserts an inner throw yields `invalid_input` and the error message ("fire") does not cross. |
| CONN-1 | **A roster fetch failure is truthful, not mislabeled** | `listRoster` `no_connection` → `no_connection` refusal (not silently `invalid_input` or an uncaught throw) | handler returns `REFUSE_NO_CONNECTION` on `roster.kind === 'no_connection'`; a non-roster non-connection result → `invalid_input`. Test asserts the `no_connection` path, no row. |
| RED-1 | **Redaction — diagnostics log only status + category, never the PIN/hash/salt/credential** | the handler's `log()` emits `{event, category}` only; no PIN, no roster body, no token | handler `log('info', 'provision_cashier_pin.*', category?)` — logs an event tag + optional refusal category; never the request. Inherits 004's `forbidden-keys` redaction baseline (`s1-redaction-evidence.md`). |
| ATOM-1 | **Success implies a sealed row + a committed audit event** (NFR-1 / P18) | on success the row is durably written sealed AND `cashier.pin.provisioned` is emitted, attributed to the manager, secret-free | handler: INSERT (sealed `pin_hash`/`pin_salt`) → `auditEmitter.emit({action_category:'cashier.pin.provisioned', acting_operator_id, payload:{target_cashier_id, terminal_id}})` → return `pin_provisioned`. See R-NFR1-TXN (§8) on the async-hash transaction boundary. |

---

## 5. Threat Model

**Trust boundary.** The renderer is **untrusted** (Constitution P8 — `contextIsolation: true`,
`nodeIntegration: false`, `sandbox: true`). `provisionCashierPin` is the only new way the renderer can
reach the PIN-provisioning subsystem. The main process (handler, SQLite, safeStorage, `BackendClient`,
device token) is trusted and reachable only through this one enumerable, typed channel.

| # | Threat | Vector | Mitigation (control) |
| :--- | :--- | :--- | :--- |
| T1 | **Cashier escalates to provision PINs** | a cashier-role session calls the channel | AD-1 — `requireRole` first; cashier → `role_mismatch`, no row. |
| T2 | **Renderer forges scope to provision into another tenant/terminal** | request carries `tenant_id`/`terminal_id` to target a foreign scope | VII-1 + INP-1 — request has no scope fields; scope comes from pairing; validator ignores anything extra. |
| T3 | **PIN exfiltration / leak** | renderer reads the PIN/hash/salt out of a response, log, or audit row | SEC-1 + RED-1 — PIN flows only into hash+seal; response is status only; audit payload is `{target_cashier_id, terminal_id}`; logs carry event+category only. Asserted secret-free by test. |
| T4 | **Provider-coupling smuggled back in** (defeats born-neutral, VIII) | `not_ready` silently falls back to keying on the Clerk subject | ID-1 — absent neutral key → `not_ready`, hard stop; no code path writes a clerk-keyed row from this handler. |
| T5 | **Overwrite an existing PIN via the create path** (privilege/audit bypass) | call provision on an already-provisioned cashier to silently reset their secret without the reset audit trail | WR-1 — create-only guard across both key columns → `state_invalid`; the existing secret is never touched; directs to the audited reset path. |
| T6 | **Error/stack disclosure** | a DB/seal/roster fault throws across the bridge, leaking a query echo or stack | IPC-1 — the IPC handler catches and degrades to generic `invalid_input`; the handler's own refusals are typed. |
| T7 | **Neutral↔clerk identity mapping leaks to the renderer** | the renderer learns which Clerk subject a neutral `user_id` maps to | RES-1 — the mapping is resolved main-side via `BackendClient`; the renderer-facing roster type carries no `user_id`; neither the request nor the response carries the clerk id. |
| T8 | **Connection-state confusion** | a roster outage is mislabeled as bad input, or throws, masking the real cause | CONN-1 — `no_connection` surfaces truthfully; no row; not conflated with `invalid_input`. |

---

## 6. Renderer Exposure Statement

Through `provisionCashierPin`, the renderer can observe **only**:

- on success: `{ kind: 'pin_provisioned', audit_event_id }` — the audit event id is the echo of the
  client-supplied `event_id` (P5 idempotency), not a secret.
- on failure: `{ kind: 'refused', category }` with `category ∈ {role_mismatch, not_ready, state_invalid,
  invalid_input, no_connection}` — generic, non-factor-distinguishing.

**Not present** in any response: the plaintext PIN / its Argon2id hash / its salt / the device token / JWT /
session token / the cashier's Clerk subject id / the branch roster body / any credential. The renderer
supplies the neutral `target_user_id` (it already holds it, to choose a cashier) and the PIN (which it
collected); it never receives the clerk-id mapping back. `contextIsolation: true` /
`nodeIntegration: false` / `sandbox: true` unchanged.

---

## 7. Born-Neutral / No-Provider-Lock-In Statement (Constitution VIII — advanced)

`provisionCashierPin` writes the local unlock factor keyed on the **provider-neutral `user_id`**, not the
Clerk subject (FR-2 / contract Invariant 5). It mints no backend token, is never a backend credential, and
the PIN remains a purely local unlock factor (the cashier unlocks offline thereafter — NFR-2, proven by the
verifier-consumable test). This strengthens VIII: a PIN provisioned through this channel carries no
provider lock-in at creation, so 017's re-anchor migration touches zero 019-created rows. There is **no
upward write path** on this surface — it is a local create only; it sends no POS-originated data to the
backend (the only outbound call is the read-direction `listRoster` lookup, which sends only the branch id).

---

## 8. Remaining Risks & Gate Dependencies

**R-NFR1-TXN (LOW — carried to §A5).** NFR-1 / P18 calls for the existence-check + INSERT + audit-emit to
be atomic. `hashPin` is async (Argon2id), so the write cannot sit inside a synchronous `better-sqlite3`
`db.transaction()`. The handler therefore does: roster-resolve → existence-check → async hash+seal →
INSERT → emit, **un-wrapped** — exactly the shape the long-reviewed `resetCashierPin` already uses. The
concurrent provision/reset race is bounded by the `cashier_pin_records` PRIMARY KEY: a duplicate INSERT
throws, the IPC catch degrades it to a generic refusal (IPC-1), and no partial/lost-update row results.
This is a **data-consistency** residual, not a bridge-boundary one; it does not weaken any §4 control.
§A5 should confirm the race posture on target hardware (or wrap the sync portion in a transaction if a
tighter guarantee is wanted).

**R-DP2-LIVE (informational).** Until DP-2 ships the roster `user_id` field (017 OUTBOX), every call
returns `not_ready` — the truthful state (P9). This is a functional/coordination gate, not a security one;
the security posture is identical whether the field is present (success path) or absent (`not_ready`).

### Gates not cleared by this review

| Gate | Condition |
| :--- | :--- |
| §A5 | Production readiness — runbook, rollback, the R-NFR1-TXN race posture on target hardware, manual smoke (T033, DP-2-gated). Blocks the rollout. |
| (held dep) | DP-2 roster `user_id` field — blocks live end-to-end completion (not this bridge gate). |

---

## 9. Verdict

**§A4 CLEARED (caveated).** The `operator.provisionCashierPin` bridge expansion is, as built:
role-gated-first, generic-refusal, scope-from-pairing (never the renderer), create-only (no overwrite, no
duplicate, incl. legacy rows), secret-free (PIN/hash/salt never cross the bridge, are never logged, never
in the response or audit), redaction-covered, throw-safe at the IPC boundary, truthful on connection
failure, and strictly local-create with no upward write path. The one genuinely new element — resolving the
provider-neutral `target_user_id` to the cashier's Clerk id — is performed **main-side** and never leaks the
mapping to the renderer (RES-1), preserving minimum-disclosure (Constitution VII) and advancing VIII
(born-neutral). All 12 §4 controls are observed in the as-built diff with test evidence.

Two residuals are carried, **neither re-opening the bridge boundary**: R-NFR1-TXN (a §A5 data-consistency
confirmation, matching the existing reset path) and R-DP2-LIVE (the held upstream field; security posture is
identical in the `not_ready` state). Any future change that introduces an **upward write path** on this
surface, accepts **scope from the renderer**, or **echoes a secret/clerk-id mapping** returns here.

---

**End of §A4 bridge-security review.** Prepared 2026-06-13 on `feat/019-provisioning-impl`
(`73aae55`→`da7e6c7`); post-implementation walk for T032. Mirrors 004's `security-review/s1-review.md`
(operator-bridge baseline) and 010's `security-review/s4-review.md` (structure), adapted to a
post-implementation gate since the handler is written and tested.

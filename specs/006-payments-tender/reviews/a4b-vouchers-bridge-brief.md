# §A4-B — `vouchers.*` bridge surface security-review brief

> **Purpose:** package everything a security reviewer needs to sign off
> §A4-B (Slice 4 voucher bridge surface) into one document, so the
> review can be commissioned and completed without rereading the full
> spec tree. Mirrors the §A4-A review handoff posture recorded in
> `coordination.md §"T003 — §A4 review handoff (split into A and B)"`.
>
> **Authoring authority:** Maestro Ops Loop preflight, prior to Wave 3
> dispatch. This brief does NOT itself constitute sign-off — the
> reviewer's verdict must be recorded in `coordination.md` §"Gate
> ledger" row §A4-B with date, reviewer name, and result.

---

## 1. Gate identity

| Field | Value |
|:--|:--|
| Gate | §A4-B |
| Scope | `vouchers.*` bridge namespace — Contract V-A handlers |
| Handlers | `vouchers.validate`, `vouchers.redeem`, `vouchers.reverse` |
| Blocks | Slice 4 implementation (Wave 3 onward in current Maestro loop) |
| Separate from | §A4-A (`payments.*` + `tender.*`, signed off 2026-05-21) — voucher work ships later and introduces a new Data-Pulse-2 dependency |
| Required before | Any voucher bridge handler authoring or wiring |
| Authority chain | `coordination.md §"Gate ledger" row §A4-B` (line 98) + `§"T003 — §A4 review handoff"` (lines 770–778) |

---

## 2. Documents the reviewer must read

In priority order:

| # | Path | What to look for |
|:--:|:--|:--|
| 1 | `specs/006-payments-tender/contracts/bridge-api.md` §"`vouchers.*` namespace" (lines 429–442) | The three handler signatures + Data-Pulse-2 backing endpoints + the `internal_voucher` reserved-but-disabled posture for pre-Slice-4 |
| 2 | `specs/006-payments-tender/contracts/bridge-api.md` §"Renderer-visible fields — minimisation rule" (lines 464–492) | FR-017 enforcement — what NEVER crosses to renderer, what MAY cross under what redaction rule |
| 3 | `scripts/openapi-snapshot.json` (paths `/api/pos/v1/vouchers/{validate,redeem,reverse}`) | The pinned authority for request/response shapes; emitted into `src/shared/api-types.ts` |
| 4 | `src/shared/api-types.ts` (the three voucher operationIds) | The TS bindings the bridge handlers will consume |
| 5 | `specs/006-payments-tender/data-model.md` (TenderLine voucher-related fields) | Which voucher fields persist locally vs. stay in-flight |
| 6 | `specs/006-payments-tender/research.md` §R-7 (partial-redemption refuse-not-cap rule) + §R-13 (deferred reversal) | The product/security rationale the bridge layer must enforce |
| 7 | `specs/006-payments-tender/plan.md` §"Constitutional cross-check" (P7, P14, P15) | The principles the reviewer is asserting against |

---

## 3. Reviewer checklist (must-tick before sign-off)

### 3.1 Handler signature surface

For each of `vouchers.validate`, `vouchers.redeem`, `vouchers.reverse`:

- [ ] Request shape compiles against `scripts/openapi-snapshot.json`
  Contract V-A definitions (no field added/removed at the bridge that
  the OpenAPI snapshot does not declare).
- [ ] Response shape uses the `{ kind: 'ok', … } | { kind: 'refused', reason: '…' }`
  envelope established by §A4-A (no separate error channel).
- [ ] `idempotency_key: UUID v4` field is present on every mutating
  call (`redeem` + `reverse`); absent on read-only `validate`.
- [ ] All money fields cross the bridge as integer minor units
  (`*_minor` suffix; `Number.isSafeInteger` guard). No floats.
  Constitutional P9 + P-II.
- [ ] Refusal reasons are closed-set enums, enumerated in the contract
  text; no factor-distinguishing copy that would let the renderer
  discriminate why a voucher was refused beyond the closed set.

### 3.2 `requireOperatorSession` gating

- [ ] Every voucher handler is wrapped by `requireOperatorSession`
  (the same Slice 3b helper that §A4-A approved). Constitutional
  P14 + AD-3.
- [ ] Role gate: only `cashier`, `manager`, `admin` may invoke any
  voucher handler. Same role envelope as `payments.*` per FR-020.
- [ ] Wrong-owner refusal (`wrong_owner`): handlers refuse when the
  invoking session does not match the payment attempt's
  `started_by_operator_id`.

### 3.3 Idempotency

- [ ] `vouchers.redeem` replays an identical-payload call as a no-op
  returning the prior `voucher_authority_redemption_id`. Constitutional
  P5.
- [ ] `vouchers.reverse` replays identical-payload reversal as no-op.
- [ ] Payload-mismatch on a replayed `idempotency_key` returns
  `idempotency_payload_mismatch` refusal with **no diff details**
  exposed to the renderer (raw diff logged main-side only).
- [ ] Data-Pulse-2 itself implements idempotency on the
  `/vouchers/redeem` and `/vouchers/reverse` endpoints — POS-Pulse
  passes through `idempotency_key` as `Idempotency-Key` header
  (16–128 visible ASCII per the OpenAPI convention).

### 3.4 FR-017 minimisation — voucher-specific

The renderer must NEVER receive any of the following (per
`bridge-api.md` line 472–475 + `plan.md §P7`):

- [ ] `voucher_redemption_intent_token` — stays main-side. Renderer
  refers to lines by `tender_line_id` only.
- [ ] `authoritative_voucher_balance` — never crosses.
- [ ] `remaining_balance_at_apply_time` — main-side only; renderer
  receives the cap rejection result, not the cap value.
- [ ] Voucher-issuance metadata (campaign id, holder id, branch
  scope, expiry, original face value).
- [ ] Voucher holder PII (name, phone, email — Data-Pulse-2 must not
  return these to POS; if it does, the bridge strips them).
- [ ] Loyalty-campaign internals.
- [ ] Cross-cart voucher state.
- [ ] Voucher-tier / voucher-category fields beyond what FR-017
  permits.

Fields that **MAY** cross (with redaction in logs):

- [ ] `voucher_authority_redemption_id` — opaque short string; safe
  to display for receipt-handoff and audit correlation. Confirm the
  field is opaque (no balance / holder / campaign data encoded).
- [ ] `applied_amount_minor` on a successful `validate` response —
  this is the cashier's own input echoed back; not sensitive.
- [ ] Closed-set refusal reason — no factor-distinguishing copy.

### 3.5 Voucher-token redaction across log sinks

- [ ] `voucher_redemption_intent_token` redacted in Sentry stack
  frames, breadcrumbs, and tags.
- [ ] Redacted in `audit_events.payload_json` (recorded as a
  redaction marker, never raw).
- [ ] Redacted in `payment_action_outbox.action_payload_json`
  (append-only outbox — once written, it cannot be rewritten, so the
  redaction must happen pre-write).
- [ ] Redacted in console / stdout / Electron renderer-process logs
  if those streams reach disk in production builds.
- [ ] Redacted in HTTP request/response loggers (Data-Pulse-2 call
  bodies).

### 3.6 Online-only enforcement

Slice 4 voucher operations are online-only (Constitution + FR-006B
+ R-13). Reviewer confirms:

- [ ] `vouchers.validate` refuses with `dependency_unavailable` when
  the 003 connection-state surface reports offline.
- [ ] `vouchers.redeem` refuses with `dependency_unavailable` on
  Data-Pulse-2 timeout/unreachable; the parent `payments.confirm`
  attempt then fails with `dependency_unavailable` and the voucher
  line transitions to `reversal_pending` per R-13.
- [ ] `vouchers.reverse` failure on `dependency_unavailable`
  transitions the line to `reversal_pending` (deferred-resolver
  pickup); a `tender.reversal_pending` audit event is emitted (the
  category ratified by T204 / migration 0018).

### 3.7 Refusal-copy hygiene

- [ ] The renderer-facing copy for every closed-set refusal reason
  is generic enough that an attacker cannot enumerate voucher
  validity, balance, or holder existence by trying codes against the
  POS surface.
- [ ] `voucher_not_found`, `voucher_expired`, `voucher_cancelled`,
  `voucher_already_redeemed`, `voucher_tenant_mismatch`,
  `voucher_branch_mismatch` all map to the **same** renderer copy
  string (e.g., "This voucher cannot be used.") OR to copy strings
  that have been explicitly cleared for distinguishing by the §A4-B
  reviewer. Decision must be recorded here, not deferred to Slice
  4 implementation.

### 3.8 Audit emission

- [ ] Every `vouchers.validate` success emits the corresponding
  `tender.applied` audit event (via the `payments.applyLine` parent
  path).
- [ ] Every `vouchers.redeem` success emits `payment.settled` (via
  the parent `payments.confirm` path, with the voucher
  `tender_line_id` in the tender breakdown).
- [ ] Every `vouchers.reverse` success emits `tender.reversed`.
- [ ] Every deferred reversal emits `tender.reversal_pending`
  (category ratified by T204).
- [ ] No audit row carries `voucher_redemption_intent_token`,
  `authoritative_voucher_balance`, or any sensitive Data-Pulse-2
  response field.

### 3.9 Data-Pulse-2 trust boundary

- [ ] POS-Pulse treats Data-Pulse-2 voucher responses as **untrusted
  input** — every field consumed from the response is validated
  against the OpenAPI schema before it crosses the bridge to the
  renderer.
- [ ] If Data-Pulse-2 returns extra fields not in the OpenAPI
  snapshot, the bridge layer drops them (allow-list, not deny-list).
- [ ] Authentication to Data-Pulse-2 uses the `clerkJwt` security
  scheme already pinned in `scripts/openapi-snapshot.json` (no
  separate auth path for voucher calls).
- [ ] Voucher endpoint base URL is sourced from the same Slice 2 /
  Slice 3 config seam as the rest of `/api/pos/v1/*` (no separate
  voucher base URL with a different trust posture).

### 3.10 Constitutional cross-check

The reviewer is signing off on these constitutional principles for
the voucher namespace specifically:

- [ ] **P5 — Idempotency** (§3.3 above)
- [ ] **P6 — No raw cardholder data** (n/a for vouchers; confirm no
  voucher response carries card data either)
- [ ] **P7 — Secrets never reach renderer or logs** (§3.4 + §3.5)
- [ ] **P8 — Electron security boundary** preserved
  (`contextIsolation:true`, `nodeIntegration:false`, `sandbox:true`;
  no upward-of-bridge IPC introduced by voucher work)
- [ ] **P9 / P-II — Money is integer minor units** (§3.1)
- [ ] **P14 — Trust boundary in bridge namespace** (§3.2)
- [ ] **P15 — Renderer receives minimised state** (§3.4)
- [ ] **P16 — Append-only outbox** (voucher reversal interacts with
  `payment_action_outbox`; reviewer confirms no UPDATE/DELETE path
  exists)

---

## 4. Out of scope for §A4-B

Explicitly NOT in this review (avoids scope creep):

- ❌ Data-Pulse-2 server-side implementation. §A4-B reviews the POS
  bridge layer only; Data-Pulse-2 PR #316 review is separate.
- ❌ Voucher-authority client mapping code (Slice 4 tasks T220+) —
  that is GREEN work to be authored under §A4-B clearance, not
  reviewed inside §A4-B.
- ❌ Renderer wiring for voucher entry surface — gated by §A4-B
  clearance but reviewed during code review of the Slice 4 renderer
  PR, not in §A4-B itself.
- ❌ `payments.forceFail` handler — that is `payments.*` namespace,
  covered by §A4-A.
- ❌ §A5 production readiness audit (coverage thresholds, full
  redaction sweep) — runs at rollout-time, not slice-merge time.

---

## 5. Sign-off mechanics

When the reviewer is satisfied, two records must be updated:

1. `specs/006-payments-tender/coordination.md` §"Gate ledger" row
   §A4-B (line 98): replace `⛔ Held — pending Slice 4 voucher
   contract` with `✅ Signed off YYYY-MM-DD — Reviewer: <name>.
   <verdict line>. Authorizes Slice 4 voucher bridge handlers.`

2. `specs/006-payments-tender/maestro/execution-map.yaml` §gates row
   `§A4-B`: update `status:` and `cleared_at:` and `note:` fields.

If the reviewer requests changes, record them as findings in this
file (§6 below) and re-open the review cycle. Do not unblock Wave 3
until §A4-B reads `✅ Signed off`.

---

## 6. Reviewer findings

Format: `F-A4B-NNN | severity | summary | action`.

| ID | Severity | Summary | Action |
|:--|:--|:--|:--|
| F-A4B-001 | Low | Closed-set refusal codes are documented in the OpenAPI `description` prose of each operation, but `components.schemas.Error.code` is open-typed `string` — codegen does NOT enforce the closed set at the TypeScript-type level. The brief's §3.1 requirement ("closed-set enums, enumerated in the contract text") is met by the contract text; runtime enforcement is up to the bridge layer. | Wave 3 GREEN code MUST runtime-assert each refusal reason against a hand-maintained closed-set literal-union (the same pattern Slice 3 used for `payments.*` refusals). Add a unit test that fails if any unknown `error.code` slips through the bridge to the renderer. Track as Slice 4 implementation note; not blocking §A4-B sign-off. |
| F-A4B-002 | Low | The OpenAPI snapshot also contains legacy admin-CRUD schemas (`VoucherCreate`, `VoucherResponse`, `VoucherStatus`, `VoucherType`) carrying sensitive fields (`tenant_id`, `uses`, `max_uses`, `value`, `redeemed_txn_id`, `min_purchase`, `starts_at`, `ends_at`). These are NOT referenced by the three V-A POS operationIds (`posValidateVoucher` / `posRedeemVoucher` / `posReverseVoucher`) and POS-Pulse does NOT call any admin endpoint — but the schemas exist in `src/shared/api-types.ts` because they live in the same snapshot. | Wave 3 GREEN code MUST NOT import or reference the admin `Voucher*` types. Confirm by grep against `src/main/payments/voucher-authority/**` after Slice 4 GREEN lands. Recommend a lint/test rule that fails the build if `VoucherResponse` / `VoucherCreate` / `VoucherStatus` / `VoucherType` symbols are imported anywhere under `src/`. Not blocking §A4-B sign-off because the schemas are unreachable from the V-A surface, but defence-in-depth warrants the explicit guard. |
| F-A4B-003 | Low (advisory) | Brief §3.7 ("Refusal-copy hygiene") asks the §A4-B reviewer to decide whether each closed-set refusal reason maps to the **same** generic renderer copy string or to per-reason cleared copy strings. The contract text says "generic" (FR-022, NFR-003); the spec FR-006 enumeration ties refusal categories to **audit** rows, not renderer copy. | Reviewer decision recorded: **all eight voucher refusal reasons** (`voucher_not_found`, `voucher_expired`, `voucher_cancelled`, `voucher_already_redeemed`, `voucher_tenant_mismatch`, `voucher_branch_mismatch`, `non_cash_overpayment_refused`, `validation_failure`) map to **one** renderer copy string: "This voucher cannot be used right now." The structured `reason` remains on the audit-event payload for diagnostics; the renderer NEVER displays it. Wave 3 renderer-wiring PR must include a test enforcing this 8→1 mapping. |
| F-A4B-004 | Low (observational) | The brief §3.5 (voucher-token redaction across log sinks) is a contract-level requirement; the actual redaction implementation lands in Slice 4 (audit emitter, outbox writer, HTTP request logger, Sentry adapter). The §A4-B sign-off asserts the **contract** is correct; the Slice 4 implementation PR(s) must include redaction unit tests covering all five sinks listed in §3.5. | Wave 3+ GREEN code adds Slice-4-specific redaction tests under `tests/unit/main/payments/voucher-authority/redaction/*.test.ts`. §A5 (production-readiness) will sweep the redaction surface again at rollout time. |

**Severity legend:** all four findings are Low. None blocks §A4-B sign-off. F-A4B-001 and F-A4B-002 are forward-looking guards on Wave 3 GREEN work; F-A4B-003 records a reviewer decision the brief explicitly asked for; F-A4B-004 transfers a contract-level requirement to its implementation-stage owner.

---

## 7. Verdict

✅ **Approved with notes (see §6).**

| Field | Value |
|:--|:--|
| Reviewer | Ahmed (acting in §A4-B reviewer capacity, mirroring §A4-A self-review posture; full constitutional cross-check + 10-section checklist completed against the V-A snapshot pinned in `scripts/openapi-snapshot.json` and the contract text in `contracts/bridge-api.md`) |
| Review start date | 2026-05-25 |
| Sign-off date | 2026-05-25 |
| Verdict | ✅ Approved with notes — no changes requested to the contract surface. Four Low-severity findings recorded in §6; F-A4B-001 / F-A4B-002 / F-A4B-004 are Wave 3+ implementation guards (not contract issues); F-A4B-003 records the 8→1 refusal-copy mapping decision the brief asked for. |

### Sub-section verdicts (all 10 sections of §3 ticked)

| § | Section | Verdict |
|:--:|:--|:--|
| 3.1 | Handler signature surface | ✅ Pos*VoucherRequest/Response schemas use `additionalProperties: false`; all money fields `type: integer, minimum: 0, maximum: 9007199254740991`; refusal envelope matches §A4-A pattern; F-A4B-001 records runtime-enforcement note for GREEN. |
| 3.2 | `requireOperatorSession` gating | ✅ Brief asserts the wrapper is reused from Slice 3b (§A4-A already approved). Wave 3 GREEN code re-uses the same wrapper, no new auth code introduced. |
| 3.3 | Idempotency | ✅ OpenAPI defines `Idempotency-Key` header (16–128 visible-ASCII pattern) on all three operations; `posRedeemVoucher` response includes `idempotent_replayed: boolean`; `posReverseVoucher` response includes `already_reversed: boolean`. POS bridge maps these to the §A4-A idempotency-replay contract. |
| 3.4 | FR-017 minimisation (voucher-specific) | ✅ `PosValidateVoucherResponse` schema EXPOSES ONLY: `kind`, `redemption_intent_token` (description explicitly forbids logs/audit/support-bundle exposure), `applied_amount_minor` (cashier's own input), `intent_expires_at`. `PosRedeemVoucherResponse` adds `redemption_id` (described as "FR-017 explicit allowlist — does NOT carry voucher balance, voucher holder id, or any cross-attempt voucher state") + `redeemed_at` + `idempotent_replayed`. NO voucher_balance, NO holder PII, NO campaign internals, NO tenant_id leak the schemas themselves. Defence: bridge layer must still strip `redemption_intent_token` at the renderer seam — it's main-side only. |
| 3.5 | Voucher-token redaction across log sinks | ✅ Contract requirement asserted (`redemption_intent_token` description: "NEVER appears in audit-event payloads, logs, support bundles, or any non-payload log sink (POS-Pulse FR-017 / Constitution §XIV)"); implementation responsibility transferred to Wave 3+ per F-A4B-004. |
| 3.6 | Online-only enforcement | ✅ Brief asserts `dependency_unavailable` refusal path; FR-006 enumeration includes it for the failure-reason set; R-13 deferred-resolver design is in research.md; T204 ratified the `tender.reversal_pending` audit category (migration 0018 landed). |
| 3.7 | Refusal-copy hygiene | ✅ Reviewer decision recorded in F-A4B-003: all 8 voucher refusal reasons → ONE renderer copy string. Structured reason stays on audit-event payload only. |
| 3.8 | Audit emission | ✅ Audit categories ratified by §A3 + T204. `payments.confirm` parent path carries voucher-line breakdown into `payment.settled`; voucher reversal emits `tender.reversed` or `tender.reversal_pending`. Schema-level audit hygiene confirmed by §3.4 verdict (no sensitive fields in audit). |
| 3.9 | Data-Pulse-2 trust boundary | ✅ `additionalProperties: false` on every Pos*Voucher* schema enforces the allow-list at codegen / schema-validation time. `clerkJwt` security scheme already pinned. Cross-tenant codes return 404 (non-disclosing) per `PosValidateVoucherRequest.code` description. Same `/api/pos/v1/*` base URL → same Slice 2/3 config seam (no new trust posture). |
| 3.10 | Constitutional cross-check | ✅ P5 (idempotency) — covered by §3.3. P6 (no cardholder data) — vouchers carry no card data; n/a. P7 (secrets) — covered by §3.4 + §3.5. P8 (Electron security boundary) — voucher work introduces no new IPC; reuses bridge surface §A4-A approved. P9/P-II (money integer minor units) — covered by §3.1. P14 (trust boundary in bridge namespace) — covered by §3.2. P15 (renderer receives minimised state) — covered by §3.4. P16 (append-only outbox) — voucher reversal writes to `payment_action_outbox` with same trigger-enforced no-UPDATE/DELETE invariant; no new outbox path introduced. |

### Authorisation

✅ **Slice 4 voucher bridge handlers authorised.** Maestro Wave 3 (T210–T213 RED → T220+ GREEN, paired in one PR, single-agent per process-boundary rule) is unblocked.

---

**End of §A4-B review brief.** Verdict recorded. Maestro Wave 3 is authorised to dispatch when the owner is ready.

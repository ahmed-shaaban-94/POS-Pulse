# §A2 — Slice 2 Migration Review (005-sales-cart)

**Feature:** 005-sales-cart
**Gate:** §A2 — four-table migration review (P4 + Constitution VII)
**Reviewer:** Ahmed Shaaban
**Review date:** 2026-05-14
**Status:** ✅ **CLEARED** — S2 may start
**Base SHA at review time:** `e5c2d74` (PR #151 merge — "feat(pos): add sales cart shell")
**Constitution version pinned:** v1.5.1

> This file is the durable §A2 sign-off. It is **docs-only**: no SQL is
> authored here. The migration files themselves are authored by the S2
> implementer under tasks T040–T043, with this review as their input.
> Approval of THIS file unblocks the §A2 gate; the actual migration PR
> still ships its own diff and tests.

---

## 1. Gate decision

**§A2 CLEARED — 2026-05-14.**

Conditions for clearance — all met as of base SHA `e5c2d74`:

| Condition | Status |
|:--|:--:|
| Phase 2 foundation (T006–T016) merged (PR #150) | ✅ |
| S1 shell (T001 + T020–T029) merged (PR #151) | ✅ |
| `data-model.md` describes all 4 cart tables, fields, invariants, FK graph | ✅ |
| Constitution P4 (append-only audit) analysis recorded for each table | ✅ |
| Test plan T036–T039 defined and located | ✅ |
| Implementation plan T040–T054 sequenced and file-owner-resolved | ✅ |
| Security notes recorded (integer minor units, redaction, no audit emission) | ✅ |

S2 (tasks T030–T054) MAY now be scheduled. §A3 and §A4 remain pending
and gate S3 and S4 respectively (see §10 below).

---

## 2. S1 prerequisite evidence

- **PR #150** — Phase 2 foundation. Lands `CartState` enum + FSM,
  `PaymentIntentEnvelope` type + recursive freeze, `cart.*` bridge
  namespace skeleton, `requireOperatorSession` wrapper, `cartStore`
  Zustand slice, preload stubs. Merged `30640b0`.
- **PR #151** — S1 shell. Lands `features.cart` flag (default
  off; env var `POS_PULSE_FEATURE_CART`), `CartBridgeHandlers` with
  in-memory `cart.create` + 9 role-gated stubs, IPC registration,
  CartPane + EmptyCartPlaceholder, sign-out hook (Q3), cart-payload
  redaction defence-in-depth. Merged `e5c2d74`.
- **No persistence on disk yet.** The S1 in-memory `Map<cart_id, CartRecord>`
  in `src/main/cart/cart-bridge.ts:83` is intentionally non-durable and
  is replaced by SQL writes in S2 (T045–T048). Cart drafts surviving
  application restart (FR-028) lands in S2; T038 is its integration
  test.

---

## 3. Required migration order (FK-safe)

Continuing the monotonic numbering convention (`0001_init.sql` …
`0007_shifts.sql`), the four cart migrations land at `0008`–`0011`:

| # | File | Authored by | Notes |
|:--|:--|:--|:--|
| 0008 | `migrations/0008_carts.sql` | T040 | No outbound FKs into cart tables. |
| 0009 | `migrations/0009_cart_action_outbox.sql` | T041 | `line_id` FK is **nullable** (cart-level rows). |
| 0010 | `migrations/0010_cart_lines.sql` | T042 | `last_action_id` FK → `cart_action_outbox.action_id`. |
| 0011 | `migrations/0011_cart_line_discount_placeholders.sql` | T043 | FKs into both `carts` and `cart_lines`. |

The outbox-before-lines order resolves the cycle between
`cart_lines.last_action_id` and `cart_action_outbox.line_id`: the outbox
is created first with a forward-declared nullable column, then
`cart_lines` is created and references the now-existing outbox.

**Numbering invariant:** S2 PRs MUST land all four migrations in one
commit (or sequential commits within the same PR) so the FK graph is
never half-installed on `main`.

---

## 4. FK graph

```
carts (1) ───< cart_lines (0..N) ────< cart_line_discount_placeholders (0..N)
   ▲                  │
   │                  └── last_action_id ───┐
   │                                        ▼
   └─────────── last_action_id ─────────> cart_action_outbox (0..N)
                                            │
                                            └── line_id (NULLABLE) ──> cart_lines
```

**Logical FKs (NOT enforced by SQL):**

| Edge | Source | Target | Nullable |
|:--|:--|:--|:--:|
| line → cart | `cart_lines.cart_id` | `carts.cart_id` | no |
| placeholder → cart | `cart_line_discount_placeholders.cart_id` | `carts.cart_id` | no |
| placeholder → line | `cart_line_discount_placeholders.line_id` | `cart_lines.line_id` | no |
| outbox → cart | `cart_action_outbox.cart_id` | `carts.cart_id` | no |
| outbox → line | `cart_action_outbox.line_id` | `cart_lines.line_id` | **YES** *(null for cart-level kinds)* |
| line → last action | `cart_lines.last_action_id` | `cart_action_outbox.action_id` | no |
| cart → last action | `carts.last_action_id` | `cart_action_outbox.action_id` | no (set on every mutation) |

**Why `cart_action_outbox.line_id` MUST be nullable:** four `action_kind`
values are cart-level and carry no line: `cart.create`, `cart.void`,
`cart.handoff_to_payment`, `cart.discarded_on_session_end`
(`data-model.md:149`).

**No FKs into 004 tables.** Per the `0004_audit_events.sql` precedent
line 3 ("No FK constraints: operator_sessions and shifts tables do not
exist until S4"), this project deliberately omits FOREIGN KEY constraint
syntax in SQLite migrations. The FK graph above is **logical** —
enforcement lives at the application layer in `cart-bridge.ts` (tenant /
ownership / version checks). S2 migrations MUST follow the same posture:
no `FOREIGN KEY (...)` clauses against `audit_events`, `operator_sessions`,
or any 004 table.

**No SQL `UNIQUE (cart_id, item_ref)` constraint.** The Q4 merge rule
(`data-model.md:115–123`) requires uniqueness of non-removed lines per
`item_ref` only. Soft-removed lines (with `removed_at IS NOT NULL`)
MUST be able to coexist with a fresh re-add for the same `item_ref`,
which a table-level UNIQUE would block. Uniqueness is **application-
layer only**, enforced inside `cart.lines.add` (T045).

---

## 5. Append-only requirement

| Table | Append-only? | Trigger pair required? |
|:--|:--:|:--:|
| `carts` | NO — mutable | NO |
| `cart_lines` | NO — mutable (incl. soft-remove via `removed_at`) | NO |
| `cart_line_discount_placeholders` | NO — mutable | NO |
| `cart_action_outbox` | **YES** | **YES** |

**`cart_action_outbox` triggers (T041 must install in the same migration as the table):**

```sql
CREATE TRIGGER IF NOT EXISTS trg_cart_action_outbox_no_update
BEFORE UPDATE ON cart_action_outbox
BEGIN
  SELECT RAISE(ABORT, 'cart_action_outbox is append-only: UPDATE is denied');
END;

CREATE TRIGGER IF NOT EXISTS trg_cart_action_outbox_no_delete
BEFORE DELETE ON cart_action_outbox
BEGIN
  SELECT RAISE(ABORT, 'cart_action_outbox is append-only: DELETE is denied');
END;
```

Pattern mirrors `migrations/0004_audit_events.sql:27-38`. Wording of the
`RAISE(ABORT, …)` message MAY differ but the **trigger names** must
follow the existing `trg_<table>_no_{update,delete}` convention so the
T036 integration test can regex-match across both audit and cart
append-only tables.

**Rationale for mutable `carts` / `cart_lines` / `cart_line_discount_placeholders`:**
cart lifecycle is intentionally mutable up to its terminal states
(`cancelled`, `frozen_handed_off`); P4 ("append-only audit") applies to
the *audit substrate*, not to the cart's own state. Cart-level
mutations are recorded in the append-only `cart_action_outbox`, which is
the audit-equivalent surface (`data-model.md:304–305`). The `synced_at`
sibling-table pattern used by `audit_events_sync_state` is **not**
required here — cart drafts are local-only and do not sync to a backend
in 005.

---

## 6. Required S2 tests (T030–T039)

**Unit tests (T030–T035, `tests/unit/main/cart/`):**

| Task | File | Purpose |
|:--|:--|:--|
| T030 | `line-subtotal.test.ts` | `quantity × unit_price_minor` integer arithmetic; `Number.isSafeInteger` guard on result; negative qty refused; ≥95% branch coverage (load-bearing P1 / NFR-002). |
| T031 | `cart-lines-add-persist.test.ts` | New-line path writes `carts` + `cart_lines` + `cart_action_outbox` in a single transaction; cart `empty → editing` on first add. |
| T032 | `cart-lines-add-merge.test.ts` | Q4 merge path — same `item_ref` twice merges into one line; `version` advances by 1; outbox row `action_kind = cart.line.merge`. |
| T033 | `cart-lines-update.test.ts` | increment / decrement / set absolute; stale `version` refused; `set(0)` delegates to remove. |
| T034 | `cart-lines-remove.test.ts` | Soft-set `removed_at`; NOT hard-delete; replay same `idempotency_key` is no-op (FR-018); stale `version` refused. |
| T035 | `cart-lines-set-note.test.ts` | ≤ 200 chars accepted; > 200 refused with `note_too_long`; partial overwrite forbidden; forbidden-pattern refused with `note_forbidden_pattern`; stale `version` refused. |

**Integration tests (T036–T039, `tests/integration/main/cart/`):**

| Task | File | Purpose |
|:--|:--|:--|
| T036 | `cart-action-outbox-append-only.test.ts` | UPDATE / DELETE raise ABORT at the SQL trigger layer. Pattern: sql.js + `readFileSync('migrations/0009_cart_action_outbox.sql')`, mirrors `tests/integration/main/audit/audit-events-durability.test.ts` initialization. |
| T037 | `cart-action-outbox-idempotency.test.ts` | Same `idempotency_key` + same payload → one outbox row, original outcome returned; same key + different payload → `{ kind: 'refused', reason: 'idempotency_payload_mismatch' }` (FR-018). |
| T038 | `cart-restart-survival.test.ts` | Build 2-line cart with 1 note → simulate restart via sql.js `db.export()` + reopen → same lines, same `version`, same note (FR-028). |
| T039 | `cart-tenant-isolation.test.ts` | Tenant T2 session attempts `cart.lines.add` on cart owned by tenant T1 → `{ kind: 'refused', reason: 'tenant_isolation' }` (FR-002). |

**Test directory:** `tests/integration/main/cart/` — NEW directory; T036
is its first occupant. Mirrors the existing `tests/integration/main/audit/`
shape.

**Coverage gate (NFR-004 + plan Test Strategy):** ≥ 95 % on the bridge-
side cart-action gate; ≥ 95 % on the `line-subtotal` module; tighter
than the global 80 % floor and audited at the S2 PR.

---

## 7. S2 implementation checklist (T040–T054)

**Migrations (§A2-gated):**

| Task | File | Owner notes |
|:--|:--|:--|
| T040 | `migrations/0008_carts.sql` | All money columns `INTEGER NOT NULL`; `state` is `TEXT` constrained to FSM enum via CHECK; no FK clauses. |
| T041 | `migrations/0009_cart_action_outbox.sql` | `action_id TEXT PRIMARY KEY`; install both append-only triggers in the same file; `line_id` column declared `TEXT` and **nullable** (no `NOT NULL`). |
| T042 | `migrations/0010_cart_lines.sql` | `removed_at TEXT` nullable; `version INTEGER NOT NULL DEFAULT 1`; `note TEXT` nullable; NO `UNIQUE(cart_id, item_ref)`. |
| T043 | `migrations/0011_cart_line_discount_placeholders.sql` | `requires_manager_attribution INTEGER NOT NULL` (0/1); `attribution_operator_id TEXT` nullable. |

**Source (T044–T054):**

| Task | File | Notes |
|:--|:--|:--|
| T044 | `src/main/cart/line-subtotal.ts` | Pure function; `Number.isSafeInteger` guard; ≥ 95 % coverage (≥ T030 RED first). |
| T045 | `src/main/cart/cart-bridge.ts` | `linesAdd` — call `cart.resolveItemRef` (R7 seam), Q4 merge detection at app layer, write `cart_lines` + `cart_action_outbox` in one tx, idempotency check first. **Sequential edit** with T046/T047/T048. |
| T046 | `src/main/cart/cart-bridge.ts` | `linesUpdate` — version check, `op` dispatch, `set(0)` delegates to remove, recompute via `line-subtotal`. |
| T047 | `src/main/cart/cart-bridge.ts` | `linesRemove` — version check, soft-set `removed_at`, outbox `cart.line.remove`, replay no-op. |
| T048 | `src/main/cart/cart-bridge.ts` | `linesSetNote` — 200-char cap, forbidden-pattern check, version check. |
| T049 | `src/renderer/ui/cart/LineItemRow.tsx` | Per S0 contact sheet §Surface 3; ≥ 44 × 44 CSS px touch targets. |
| T050 | `src/renderer/ui/cart/QuantityStepper.tsx` | Decrement-to-zero shows confirm when note non-empty; arrow-key keyboard support; ≥ 44 × 44 CSS px. |
| T051 | `src/renderer/ui/cart/LineNotePopover.tsx` | 200-char UX nicety; bridge is authoritative; forbidden-pattern refusal surfaced as generic "note rejected". |
| T052 | `src/renderer/ui/cart/CartPane.tsx` | Extend with live line list; wire bridge calls. **Sequential edit** with S1's CartPane shell. |
| T053 | `src/main/cart/resolve-item-ref.ts` | R7 stub returning fixture SKUs for tests; production path refuses generically (no catalogue until a future feature). |
| T054 | `src/main/logging/logger.ts` | Extend `CART_REDACTED_KEYS` with `note` content scrubs and `payload_json`; **MUST PRESERVE S1's existing entries** (`note`, `attribution_operator_id`) — the list is append-only by convention. |

**Single-file sequential edits to watch:** `src/main/cart/cart-bridge.ts`
sees T045 → T046 → T047 → T048 in sequence. Per `tasks.md:393`, plan
for one implementer at a time on this file.

---

## 8. Security notes

1. **Integer minor units only (P1 + NFR-002).** Every money column in
   the four cart tables is `INTEGER NOT NULL`. No `REAL`, no `NUMERIC`,
   no `BIGINT`. The `line-subtotal` module is the only arithmetic
   surface and is guarded by `Number.isSafeInteger`. Overflow → generic
   refusal at the bridge boundary.

2. **Redaction MUST preserve S1's `CART_REDACTED_KEYS`.** S1 landed
   `note` and `attribution_operator_id` in the pino redaction set
   (`src/main/logging/logger.ts:131`). T054 extends the list (e.g. to
   include `payload_json`), MUST NOT shrink it. The list is convention-
   ally append-only; a deletion regresses the cross-process redaction
   smoke (`tests/integration/cross-process-redaction-cart.test.ts`).

3. **No audit emission until S3.** Cart-emitted `audit_events` rows
   for the four sensitive `action_kind` values
   (`cart.handoff_to_payment`, `cart.cancel.post_handoff`,
   `cart.discount.above_threshold`, `cart.discarded_on_session_end`)
   are gated on §A3 and land in S3 (T055–T074). S2 writes ONLY to
   `cart_action_outbox`; it does NOT call `auditEmitter.emit()`. A
   defensive check at S2 PR review: `grep auditEmitter src/main/cart/*`
   should return zero hits in T040–T054 territory.

4. **No PII in `payload_json`.** Cart-payload allowlist (NFR-006) scrubs
   `note` content and credential fragments before serialisation into
   the outbox row's `payload_json` column. The bridge handler MUST
   canonicalise the payload through the same allowlist 004's audit
   emitter uses (`src/shared/audit/forbidden-keys.ts`).

5. **`requireOperatorSession` remains the first trust boundary** — every
   S2 handler still starts with the role + tenant + ownership gate.
   The new persistence calls follow the gate, never precede it.

6. **No FK enforcement at SQL layer** means the application layer MUST
   refuse stale FK references (e.g., a `line_id` whose parent
   `cart_id` does not exist). T039 (tenant isolation) covers the
   cross-tenant case; T031/T033 implicitly cover orphaned line/cart
   references via the version-check refusal.

---

## 9. Go / no-go conclusion

**Go.** §A2 cleared 2026-05-14 against base SHA `e5c2d74`.

- The 4-table migration order, FK graph, append-only trigger
  requirement, test plan (T030–T039), and implementation plan
  (T040–T054) are all unambiguous and consistent with `data-model.md`,
  `plan.md`, `tasks.md`, and the 004 `audit_events` precedent.
- No outstanding clarifications. Q1–Q5 (locked 2026-05-14) are
  honoured by the plan above (Q1 → T048 200-char cap; Q2 → T053 R7
  seam reads threshold at apply-time; Q3 → already in S1 via
  `cart-signout-hook.ts`; Q4 → T032 + T045 application-layer
  uniqueness; Q5 → cart-level outbox row + S3 audit emission deferred).
- No P4 violations: the append-only constraint is applied to
  `cart_action_outbox` only; the other three tables remain
  intentionally mutable with documented rationale.

S2 (T030–T054) is now **schedulable**. §A3 and §A4 remain pending and
gate S3 and S4 respectively.

---

## 10. Cross-gate status snapshot

| Gate | Status | Blocks |
|:--|:--:|:--|
| §A0 | ✅ CLEARED 2026-05-14 | (none) |
| §A1 | ⏳ deferred (R7 stub OK for S2) | full item-catalogue feature |
| **§A2** | **✅ CLEARED 2026-05-14** (this file) | **S2 (T030–T054)** |
| §A3 | ⏳ pending | S3 (T055–T074) — `ActionCategory` extension required |
| §A4 | ⏳ pending | S4 (T076–T091) — envelope ratification required |
| §A5 | ⏳ rollout-time | production rollout |

---

**End of §A2 review.** S2 may now begin behind this sign-off. Any
deviation from this review (e.g., changing the migration order, adding a
SQL `UNIQUE` constraint, applying append-only triggers to a mutable
table) MUST come back through `/speckit-clarify` and update this file
before merging.

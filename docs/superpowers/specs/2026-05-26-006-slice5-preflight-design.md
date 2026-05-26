# 006-payments-tender Slice 5 (Production-Readiness) Preflight Design

**Status.** Brainstormed + approved 2026-05-26. Implementation plan to follow.
**Author.** Maestro Ops Loop session, Claude Opus 4.7.
**Predecessor.** Slice 4 closed at PR #228 / commit `600b6c0`. `coordination.md` Status banner reads `SLICE 4 CLOSED`. The §A5 production-readiness gate is the last open approval on this spec.
**Authorization scope.** User has authorized recommended-option decisions across the Slice 5 effort. Empirical work, advisor consults, and structural-judgment findings are still surfaced; routine "which-of-A/B/C" recommendations proceed without per-question gates.

---

## 1. Slice 5 shape

Three sequential waves, each ending in one PR. Mirrors the discipline that carried the 15 PRs of Slices 1–4: **one wave = one PR**, no merges until the wave's verification passes.

| Wave | Tasks | Deliverable | Gate state it produces |
|:--|:--|:--|:--|
| **6a** | T300 | Coverage audit captured as a new section in `specs/006-payments-tender/coordination.md`; actual per-module numbers recorded vs. the §A5 floors from `plan.md` §"Test Strategy". | Baseline established; any sub-floor failures recorded as hold-items that must close before §A5. |
| **6b** | T301, T302, T303, T304, T305, T306 | Six independent artifacts: four docs under `docs/runbook/` + `docs/onboarding/`, one contract appendix in `specs/006-payments-tender/contracts/bridge-api.md`, one integration test at `tests/integration/payments/concurrent-start-race.test.ts`. All authored from current-codebase evidence — no human-checklist scaffolds. | All §A5 verification artifacts exist on `main`. |
| **6c** | T307, T308 | T307 verifies the production CI matrix (`codegen:verify → typecheck → lint → test → package:dir`) passes on `windows-latest` on Wave 6b's final commit (no workflow file changes — observation only). T308 records §A5 sign-off in `coordination.md`. | §A5 ✅ cleared; spec 006-payments-tender complete. |

**Out of scope.** T309 (production feature-flag flip in `src/renderer/config/feature-flags.ts`) is explicitly a future rollout PR per `tasks.md` line 451. Not part of Slice 5.

---

## 2. Wave 6a — T300 coverage audit

### Inputs

The `plan.md` §"Test Strategy" floors:

| Module | Floor | Currently (post-Slice-4) |
|:--|:--|:--|
| money-math | ≥ 95% line | to measure |
| `PaymentAttemptFsm` | ≥ 95% line | 97.44% (closed at Wave 5e) |
| `TenderLineFsm` | ≥ 95% line | 98.15% |
| `audit-emitter.ts` | ≥ 95% line | 95.00% |
| idempotency-replay | ≥ 95% line | to measure |
| voucher V-A client (5 files) | ≥ 95% line | 100% on all five |
| all bridge handlers | ≥ 95% line | mixed 92.86%–100% |
| renderer surfaces | ≥ 90% line | mixed 93.87%–100% |

### Method

1. Run `npx vitest run --coverage --testTimeout=30000`. The 30-second timeout was empirically derived in Wave 5d to keep `scripts/__tests__/codegen.test.ts` from timing out under v8 coverage instrumentation.
2. Parse `coverage/lcov.info` with the same awk script Wave 5d/5e used. Reproduced inline in the audit section so future readers don't need session history to re-run.
3. Generate the per-floor table. Pass = current ≥ floor; fail = current < floor.
4. For any failure: open a hold item in `coordination.md` §"Slice 5 — Wave 6a hold list" that lists the file, the gap, and the proposed close path (add tests, accept variance, etc.).
5. Capture whole-suite headline numbers (statements / branches / functions / lines).

### Output

One new section in `specs/006-payments-tender/coordination.md` titled `## Slice 5 — Wave 6a coverage audit (T300)`. Structure:
- Per-floor table with current values + pass/fail column.
- Hold list (empty if every floor passes).
- Whole-suite headline numbers.
- The awk script used to extract per-file metrics (reproducible).
- Date + commit SHA the audit ran against.

### PR shape

Single file change: `specs/006-payments-tender/coordination.md`. ~1–2 KB diff. No source, no tests.

### Risks

**Risk 6a-R1: A coverage floor fails.** Idempotency-replay and money-math have not been individually audited since Slice 3. If a sub-floor fails, Wave 6a's output is the discovery + hold item — sign-off (Wave 6c) cannot proceed until either tests are added (a follow-up wave) or a documented variance is approved. This is the exact posture Wave 5d took when discovering F-W5D-001.

---

## 3. Wave 6b — T301-T306 six artifacts in one PR

Execution model: **direct sequential**, all six artifacts authored in one session inside one branch and one PR. No parallel-agent dispatch — the work is spec-driven doc writing, the context is already warm, and 6 cold-start agents would add coordination tax without saving wallclock.

### T301 — `docs/runbook/006-payments-redaction-audit.md`

Constitution §P7 audit. Method:

1. Construct a Slice-3+4 mixed end-to-end scenario in `tests/integration/payments/` style: `payments.start` → `tender.apply` (cash 400) → `tender.apply` (voucher V-A with intent_token `TOKEN-LEAK-SENTINEL`) → `payments.confirm` (V-A redeem succeeds).
2. Capture every observable sink: audit-event payloads (via `auditEmitter.captured`), console.log call sites (enumerate via grep), Sentry breadcrumb shapes (from `src/main/observability/sentry-main.ts` + `src/renderer/observability/sentry-renderer.ts`), file-log writes if any.
3. Run regex sentinels:
   - `voucher_redemption_intent_token` — must not appear in any captured payload.
   - `TOKEN-LEAK-SENTINEL` — must not appear anywhere outside the FSM's internal `voucher_outcome` parameter.
   - PAN-like: `\b\d{13,19}\b` — must not appear (Slice 4 doesn't actually handle PAN; this is a guard against future drift).
   - `external_reference` plaintext (we set `T1A2B3` in test fixtures) — must not appear in audit payloads (it's hashed before insert per Constitution §P7).
   - Voucher balance / holder name fields — must not appear (FR-017).
4. Record evidence: command anyone can re-run + assertion outcomes + exact sinks audited.
5. List residual exposures (if any) + their mitigations.

### T302 — `docs/runbook/006-payments-security-review.md`

Constitution §P8 security-review handoff. Five sections per `tasks.md` T302:

(a) **Trust-boundary map.** IPC surface enumerated from `src/shared/bridge-api.ts`: `payments.*` (5 methods), `tender.*` (3 methods), `vouchers.*` (1 method). Per-method: request shape, response shape, where validated, who can call (role gate).

(b) **FSM transitions + idempotency-replay protections.** Both FSMs' transition tables (from `payment-attempt-fsm.ts` + `tender-line-fsm.ts`). The replay test surface: `idempotency.ts` + `payment_action_outbox` `UNIQUE(action_id)` constraint. The defence-in-depth posture for redeem/reverse compensating actions discovered in CR-3 (Wave 4).

(c) **`external_reference` validation+redaction chain.** Where validated (boundary), where hashed (FSM apply), where the hash lives (outbox), where the plaintext is allowed to exist (operator's hand entering it; never persisted in plaintext).

(d) **Voucher token lifecycle.** intent_token → validate (V-A returns it) → applied (FSM stores it in `payment_tender_lines.voucher_redemption_intent_token`) → redeem (handler uses it; V-A returns redemption_id; intent_token is never returned in any bridge response) → settled. The §A4-B reviewer decision: F-A4B-001 (closed-set refusal mapping), F-A4B-002 (no admin Voucher* imports), F-A4B-003 (8 reasons → 1 renderer copy), F-A4B-004 (token redaction).

(e) **Force-fail dual attribution.** FR-021 row schema: `acting_operator_id` immutable since start (= cashier); `force_fail_attribution_operator_id` populated on force-fail (= manager). Audit emission shape. The FR-021 last-clause check (manager identity NEVER in cashier-visible DOM).

Each section cites file paths + line numbers so a reviewer verifies against current code. Sign-off block at the bottom for human reviewer to tick.

### T303 — `specs/006-payments-tender/contracts/bridge-api.md` (appendix)

Per AD-9 / OQ-PLAN-8: confirm the `payment.settled` audit-event payload IS the receipt-handoff surface for the future receipts spec. Single appendix section at end of file. Lists the payload fields that the receipts spec will consume; cross-references the audit-emitter file. No new contract authoring.

### T304 — `docs/runbook/006-payments-tender.md`

Six top-level sections, each ~1 page:

1. **Cashier walkthrough — cash tender.** Empty cart → start → enter amount → confirm. Screenshot references to `src/renderer/ui/payments/CashEntry.tsx` (visual polish deferred to spec 007).
2. **Cashier walkthrough — external_card_terminal.** Enter external reference → confirm. The hashing-at-FSM detail.
3. **Cashier walkthrough — voucher.** Enter code + amount → V-A validates → on success line shows `Voucher selected` → confirm settles. The 8-refusal-reason → 1-copy collapse.
4. **Cashier walkthrough — split + cancel.** Two-tender split (cash + card), then cancel midway; LIFO reverse semantics.
5. **Manager incident response — force-fail.** Stuck `started` attempt → manager opens ForceFailSurface → confirms → attempt → `force_failed` with dual attribution.
6. **Deferred-reversal resolver ops.** When V-A is unreachable mid-confirm; the resolver re-runs on app-start + on network-restore signal + on cashier-initiated retry. Troubleshooting matrix.

### T305 — `docs/onboarding/006-payments-tender.md`

Three sections:

1. **Developer setup.** Branching off main; the migration runner; the `-- @no-wrap-transaction` opt-out marker (Wave 5e canonical example).
2. **Dev fixture voucher authority stub.** Where it lives, how to point the dev build at it (this may need to surface a missing-stub finding — see §6.R-2).
3. **Restart-survival smoke test recipe.** Reproduce the `restart-survival.test.ts` shape manually for live-app verification.
4. **Test fixtures index.** Pointers: `bridge-handler-deps.ts`, `sql-js-handle.ts`, the helper builders.

### T306 — `tests/integration/payments/concurrent-start-race.test.ts`

The only test in Slice 5. Spawn two `payments.start` calls against the same `terminal_id`; assert exactly one succeeds (per `payment_attempts_one_started_per_terminal` from migration 0013).

**Design choice — single process, not multi-process.** `sql.js` cannot simulate true multi-process concurrency. The partial unique index is the enforcer; two `PaymentAttemptFsm` instances bound to the same SQL handle inside one process are sufficient to verify it. If true multi-process testing is needed later, that's a Slice 5 followup, not Slice 5 scope.

### PR shape

Six new/extended files. Estimated:
- T301 ~3 KB
- T302 ~8 KB
- T303 ~1 KB (appendix)
- T304 ~10 KB
- T305 ~5 KB
- T306 ~4 KB

Total ~31 KB of additions. Reviewer surface: ~5 minutes for a domain-familiar reader.

### Risks

**Risk 6b-R1: T305 may discover the dev fixture voucher authority stub does not exist** (or lives somewhere undocumented). If so, the onboarding doc records that finding as a Slice 5 followup and points readers at the integration test mocks as the interim fixture. Won't block §A5 sign-off; documented gaps are acceptable.

**Risk 6b-R2: T301 evidence capture may surface a real leak.** A grep result is binary — either the sentinel doesn't appear (audit closes ✅) or it does (audit closes with a finding F-W6B-NNN, just like F-W5D-001). If found, surface immediately; do not bury.

**Risk 6b-R3: T303's appendix may discover the `payment.settled` payload is not a stable receipts surface** — it may need additional fields that 006 didn't include. If so, surface the finding; the future receipts spec authors decide whether to extend 006 or layer a new contract.

---

## 4. Wave 6c — T307 + T308 §A5 sign-off

### T307 — CI matrix verification

No workflow file changes. Method: re-trigger CI on the Wave 6b PR's final commit, confirm all five stages pass on `windows-latest`:
1. `codegen:verify` ✓
2. `typecheck` ✓
3. `lint` ✓
4. `test` (full vitest) ✓
5. `package:dir` (electron-builder dry-run) ✓

Record evidence: CI run URL + commit SHA in the PR description.

### T308 — §A5 sign-off ledger entry

New section in `coordination.md` titled `## Slice 5 — §A5 production-readiness sign-off (T308)`. Mirrors the Slice 4 sign-off ledger structure:

- Gate status: ✅ Cleared
- Per-task completion table (T300–T308) with links to each Wave 6b artifact
- Headline coverage numbers (from Wave 6a)
- Redaction-audit verdict (from T301)
- Security-review verdict (from T302)
- Race-test verdict (from T306)
- CI matrix verdict (from T307)
- Status banner at the top of `coordination.md` flipped from `SLICE 4 CLOSED` → `SLICE 5 CLOSED — spec complete`

### PR shape

Single file change: `specs/006-payments-tender/coordination.md`.

### Risks

**Risk 6c-R1: If Wave 6b surfaced any finding (per 6b-R2 or 6b-R3), Wave 6c sign-off DEFERS** — same posture as Wave 5d deferring Slice 4 sign-off pending F-W5D-001. The next wave (Slice 5 cleanup) then closes the finding before sign-off.

---

## 5. Cross-cutting concerns

### Discipline preserved across all three waves

1. **One wave = one PR.** No bundling.
2. **Stop before merge.** Each PR awaits human merge signal.
3. **Advisor consult before substantive work.** Per session standing rule.
4. **Empirical verification over theoretical claims.** Wave 5e taught the lesson.
5. **Surface findings; do not bury.** F-W5D-001 + the CodeRabbit FK catch are precedent.

### Scope guards

**Forbidden in Slice 5:**
- `src/main/**`, `src/renderer/**`, `src/shared/**` (no source changes)
- `migrations/**` (no migrations)
- `package.json`, `package-lock.json` (no dep changes)
- `.github/workflows/**` (no CI changes — T307 is observation only)
- `specs/006-payments-tender/tasks.md` (no task edits; only the Slice 5 task tickmarks may flip)

**Allowed:**
- `specs/006-payments-tender/coordination.md` (ledger entries)
- `specs/006-payments-tender/contracts/bridge-api.md` (T303 appendix only)
- `docs/runbook/006-*.md` (T301, T302, T304)
- `docs/onboarding/006-*.md` (T305)
- `tests/integration/payments/concurrent-start-race.test.ts` (T306 only)

### Findings posture

If Slice 5 surfaces any production-blocking finding (akin to F-W5D-001), the wave that found it documents the finding, opens a follow-up wave (Wave 6d, etc.), and DEFERS the §A5 sign-off until the finding closes. This is non-negotiable: §A5 explicitly blocks rollout, so a known gap cannot be papered over.

---

## 6. Open questions

None at design time. Three risks are flagged in §3 (6b-R1/6b-R2/6b-R3) and one in §4 (6c-R1); all are "if this happens, here's the posture" rather than design-time gaps.

---

## 7. Implementation order

1. **This design doc → committed → user review.** ← We are here.
2. **Implementation plan via `writing-plans` skill** — turn this design into a per-step plan agents can execute cold.
3. **Wave 6a dispatch** (T300 coverage audit).
4. **Wave 6a CI + CodeRabbit + merge.**
5. **Wave 6b dispatch** (T301–T306 evidence artifacts).
6. **Wave 6b CI + CodeRabbit + merge.**
7. **Wave 6c dispatch** (T307 + T308 sign-off).
8. **Wave 6c CI + CodeRabbit + merge.** Spec 006-payments-tender complete.

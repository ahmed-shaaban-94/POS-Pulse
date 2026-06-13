# Implementation Plan: Cashier-PIN Provisioning (004 follow-up)

**Feature ID:** 019-cashier-pin-provisioning
**Spec:** [./spec.md](./spec.md)
**Plan Version:** 1.0
**Created:** 2026-06-13
**Last Updated:** 2026-06-13
**Constitution version pinned:** v1.5.1

---

## Summary

Add the **create** path for `cashier_pin_records` — the first-PIN provisioning capability deferred from 004's MVP. A manager/admin provisions a rostered cashier's initial PIN; the row is sealed, terminal-scoped, and **keyed on the cashier's provider-neutral `user_id` from creation**. The verifier and reset/unlock paths are unchanged. The cashier's `user_id` is consumed from the branch roster (a held DP-2 upstream field); when absent, provisioning **refuses** (never falls back to a provider-coupled key — spec FR-11). Create-only: a pre-existing row (incl. a legacy clerk-keyed one) makes provisioning refuse, leaving legacy rows for 017.

## Technical Context

| Area | Choice | Source |
|:--|:--|:--|
| Touched module | `src/main/operator/` (extends `pin-management.ts`) | spec / 004 module layout |
| Verb | New main-process action `provisionCashierPin` (sibling to `resetCashierPin`) + bridge channel `operator.provisionCashierPin` | spec FR-1 / bridge-api.ts (reset precedent) |
| Identity key | DP-2 provider-neutral `user_id` (028 §16 = `users.id`), consumed from roster | spec FR-2/FR-3 |
| Row shape | Existing `cashier_pin_records` (migration `0006`); **no schema migration in 019** — the row's identity *column* it writes is `user_id` (the column 017's migration `0035` introduces). 019 writes through a repo seam that 017's migration backs. | spec Key Entities / 0006 / 017 |
| Secret gen + seal | `hashPin` (`pin-credential.ts`, Argon2id) + `sealPinMaterial` (`pin-seal.ts`, safeStorage/DPAPI) — **reused verbatim** | spec FR-6 / 004 |
| Verifier | `pin-credential.ts` / `pin-lockout.ts` — **untouched** (never keys on identity) | spec FR-8 |
| Role gate | `requireRole(['manager','admin'], session)` — reused | spec FR-4 / role-enforcement.ts |
| Scope source | `pairingStore.getStatus()` → `(tenant_id, branch_id, terminal_id)`; never from renderer | spec FR-9 / Constitution VII |
| Audit | secret-free `cashier.pin.provisioned` audit event (new category, sibling to `cashier.pin.reset`) | spec FR-7 |
| Roster `user_id` | **HELD upstream dependency** — DP-2 must add `user_id` to `PosRosterCashierEntry`; consumed via `roster-handler.ts` (allowlist widened). Until live, provisioning refuses "not ready". | spec Dependencies / 017 OUTBOX |
| DB engine | `better-sqlite3` (prod), `sql.js` (tests) | constitution Tech Stack |
| Tests | Vitest, test-first | constitution VI |
| **Sequencing vs 017** | 019 introduces the `user_id` *write path*; 017's migration `0035` introduces the `user_id` *column + PK re-key*. **019 depends on 017's migration landing for the column to exist** OR 019 carries the additive column migration. **NEEDS CLARIFICATION → resolved in research.md R-1.** | research.md |

## Constitution Check (Initial)

| Principle / Constraint | Status | Notes |
|:--|:--:|:--|
| I. Offline-First | PASS | Provisioning is a local write; the provisioned cashier unlocks offline thereafter (NFR-2). The roster `user_id` is consumed at provisioning time (an online manager action), never at unlock time. |
| II. Financial Precision | PASS | No money columns. |
| III. Process-Boundary Discipline (NON-NEGOTIABLE) | PASS | New action lives main-side; renderer reaches it only via the typed preload bridge (`operator.provisionCashierPin`). Scope from device state, never renderer. New IPC channel gets §A4 bridge-security review (P8). |
| IV. Hardware Loud | PASS | N/A. |
| V. Type Safety | PASS | `strict`; request/response DTOs typed; `user_id` flows from the roster type. No `any`. |
| VI. Test-First, Coverage-Gated | PASS | RED→GREEN; ≥80% on new provisioning logic (the operator/PIN module is high-coverage tier). |
| VII. Observability | PASS | Secret-free `cashier.pin.provisioned` audit (scope + fact + acting operator). No PIN/hash/salt. |
| VIII. Terminal Identity ≠ User (NON-NEGOTIABLE) | **PASS — ADVANCED** | Provisioning **born-neutral** keys the local unlock factor on the provider-neutral `user_id`, strengthening VIII (no provider lock-in at creation). PIN stays a local unlock factor; mints no backend token; never a backend credential. |
| IX. Reference, Not Inheritance | PASS | No `_reference/` copy-paste; re-derived from current 004 module. |
| Platform Integration | PASS | `user_id` arrives via the sanctioned POS→DP-2 roster path; no POS-minted identity. |
| Security | PASS | Secret-sealing unchanged; PIN consumed and discarded; sealed at rest; never logged/returned. |
| Hardware Matrix | PASS | N/A. |
| Domain — Pharmacy POS | PASS | Tenant/branch/terminal scope preserved (P17). |
| P1 Financial Correctness | PASS | No money surface. |
| P2 No Fake Success | PASS | "Provisioned" only after a real sealed row + audit committed; "not ready" is truthful (FR-11). |
| P3 No Silent Data Loss | PASS | Create-only; never silently replaces an existing secret (FR-5); single crash-safe transaction (NFR-1). |
| P4 Auditability | PASS | Every provisioning emits an attributable audit event (FR-7). |
| P5 Idempotency | PASS | `event_id` (client UUID) idempotency key, mirroring reset; re-submit is a no-op-or-confirm. |
| P6 No Raw Cardholder Data | PASS | N/A. |
| P7 Secrets Never Reach Renderer/Logs | PASS | PIN/hash/salt never cross the bridge upward, never logged (FR-6). |
| P8 Electron Security Boundary | PASS | New channel owned by this feature; §A4 review owed at implementation. |
| P9 Truthful Degraded States | PASS | "Not ready to provision" (no roster `user_id`) is shown truthfully; never a fake success. |
| P10 Operator Accountability | PASS | Provisioning attributed to the acting manager/admin in the audit event. |
| P11 Supportability w/o Leakage | PASS | Audit carries scope + fact, redacted. |
| P12 Spec Kit Source of Truth | PASS | Derived from spec.md. |
| P13 Small, Scoped PRs | PASS | Decomposes into bridge+DTO, provision handler, audit category, roster-allowlist, doc-fix. |
| P14 Accessibility | PASS | Reuses the existing cashier-management surface + keyboard path. |
| P15 Production Readiness Gates | PASS | Runbook/rollback authored at rollout (§A5-equivalent). |
| P16 Feature Scope Discipline | PASS | Authors no DP-2 code (roster `user_id` is requested upstream); does not do 017's re-anchor of legacy rows. |
| P17 Privacy / Tenant Isolation | PASS | `tenant_id`/`branch_id`/`terminal_id` remain NOT NULL scope. |
| P18 Local Durability Before Offline Promises | PASS | Row durably sealed before the cashier is told they can unlock. |

**Initial gate result: PASS (no VIOLATION, no WAIVED).** One **NEEDS CLARIFICATION** (R-1: whether 019 carries the additive `user_id` column migration or depends on 017's `0035`) is resolved in Phase 0.

## Phase 0 — Research

See [./research.md](./research.md). Resolves R-1 (column-migration ownership), R-2 (audit category wiring), R-3 (roster-allowlist widening against the held DP-2 field).

## Phase 1 — Design & Contracts

- **Data model:** [./data-model.md](./data-model.md)
- **Contracts:** [./contracts/](./contracts/) — the `operator.provisionCashierPin` bridge contract + the `cashier.pin.provisioned` audit payload shape.
- **Quickstart:** [./quickstart.md](./quickstart.md)

## Project Layout

```
specs/019-cashier-pin-provisioning/
  README.md spec.md plan.md research.md data-model.md quickstart.md
  checklists/requirements.md
  contracts/provision-cashier-pin.md
```

Source files the implementation will touch (named, not modified in this pass):
- `src/main/operator/pin-management.ts` — add `provisionCashierPin` (create path; refuses if row exists or no `user_id`). Gains a `backend: BackendClient` dependency.
- `src/main/operator/backend-client.ts` — **(as-built seam; T020/T021)** widen the `BackendRosterCashier` allowlist `{id,display_name,role}` → `{id,user_id?,display_name,role}` (optional `user_id`). **NOTE:** tasks.md T021 named `roster-handler.ts:43`; the seam moved to the *backend* roster type instead so the neutral↔clerk mapping the handler needs stays main-side and NEVER crosses the bridge (Constitution VII / minimum-disclosure). The renderer-facing `BranchRosterCashier` (`roster-handler.ts`) deliberately does NOT carry `user_id`.
- `src/shared/bridge-api.ts` — `ProvisionCashierPinRequest`/`Response` + channel.
- `src/preload/index.ts` — expose `operator.provisionCashierPin`.
- `src/main/ipc/operator*.ts` — register the handler.
- `src/main/index.ts` — composition root: inject `backend: operatorBackend` into `PinManagementHandler`.
- `src/shared/audit/*` — add `cashier.pin.provisioned` category + payload + `not_ready` refusal category (+ `messages.ts` copy).
- `migrations/0035_add_user_id_to_cashier_pin_records.sql` — **AUTHORED (T001/T005).** R-1 resolved: **019 owns** the additive nullable, non-key `user_id TEXT` column and claims migration number **`0035`** (next free after `0034`). 017's re-anchor migration takes the NEXT free number and does only the PK re-key + legacy backfill — it MUST NOT re-introduce the column. (017's CLAUDE.md/spec text mentioning "migration `0035`" predates this claim and now refers to 017's own later-numbered re-key migration.)
- Docs: `specs/004-operator-session/data-model.md` + `quickstart.md` — corrected "provision via reset" language (FR-10 — DONE T030).
- **Untouched:** `pin-credential.ts`, `pin-lockout.ts` (verifier — FR-8).

## Test Strategy

Vitest, test-first (RED→GREEN). New tests: provision-create success (row born keyed on `user_id`); role-gate refusal; create-only refusal on existing row (incl. legacy clerk-keyed); no-`user_id` "not ready" refusal (FR-11); secret-free audit (extends the canonical redaction test); verifier-untouched guard. ≥80% on new logic; the operator module sits in the high-coverage tier. Fixture roster carries `user_id` so the path is testable before DP-2 ships.

## CI / Build / Package

Unchanged — the standard four gates (typecheck, lint, tests, package dry-run on `windows-latest`). No codegen change (the operator/roster contracts are hand-mirrored, not in `api-types.ts`).

## Phase 2 — Implementation Outline

- **S1 — Contract + DTO.** `ProvisionCashierPinRequest`/`Response`, bridge channel, preload, handler registration. Test-first.
- **S2 — Provision handler.** `provisionCashierPin` in `pin-management.ts`: role-gate → validate PIN shape → resolve scope from pairing → require roster `user_id` (refuse "not ready" if absent, FR-11) → create-only guard (refuse if any row exists incl. legacy, FR-5) → hash+seal → INSERT keyed on `user_id` → emit audit. Single transaction (NFR-1). Test-first.
- **S3 — Roster allowlist.** Widen `roster-handler.ts` to carry `user_id` (held on the DP-2 field; tested against fixture).
- **S4 — Audit category.** `cashier.pin.provisioned` category + secret-free payload.
- **S5 — Doc fix.** Correct 004 `data-model.md`/`quickstart.md` "provision via reset" language (FR-10).
- **S6 — §A4 + readiness.** Bridge-security review for the new channel; readiness notes.

## Constitution Check (Post-Design)

Re-evaluated after Phase 1 — status remains **PASS** across the board; VIII **advanced** (born-neutral). No new principle tension introduced by the design. Migration ownership (R-1) resolved without a VIOLATION.

## Risks & Open Items

- **[HELD dep] Roster `user_id` not yet live.** DP-2 must surface it (017 OUTBOX). **Mitigation:** build/test against a fixture roster; live behavior refuses "not ready" until it lands — truthful, not broken.
- **[R-1] `user_id` column ownership** (019 additive column vs 017's `0035`). Resolved in research.md; mitigation = whichever lands first owns the column, the other treats it as present.
- **[§A4] New bridge channel** — security review owed at implementation (P8).
- **Coordination with 017** — 019 create-only refuses on legacy rows, leaving them to 017; the two features must not both write the same `(scope,cashier)` row.

---

*This plan is the source for `/speckit-tasks`. Changes to scope or technical approach after task generation MUST update this plan and re-run task generation.*

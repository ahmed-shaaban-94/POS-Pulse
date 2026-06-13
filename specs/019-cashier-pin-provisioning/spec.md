# Feature Specification: Cashier-PIN Provisioning (004 follow-up)

**Feature ID:** 019-cashier-pin-provisioning
**Status:** Draft
**Created:** 2026-06-13
**Last Updated:** 2026-06-13
**Owner:** Owner (Ahmed Shaaban)

---

## Overview

A manager or admin on a paired POS terminal can **provision a cashier's PIN for the first time** — creating that cashier's local unlock record where none exists yet. Today this path is missing: the terminal can *reset* an already-existing PIN but cannot *create* the first one, so a cashier who has never been provisioned cannot be onboarded to PIN-unlock on the terminal at all. This feature fills that gap, and does so such that each provisioned record is keyed on the cashier's **provider-neutral identifier from the moment of creation** — so the offline-PIN store is born provider-independent rather than retro-fitted later. It is a follow-up to feature 004 (operator session), correcting a capability deferred from that feature's internal/dev MVP.

## Clarifications

### Session 2026-06-13

- Q: When a rostered cashier has no provider-neutral identifier yet (unmapped upstream), what does provisioning do? → A: **Refuse** with a truthful "not ready to provision" state; never fall back to a provider-coupled key (Option A). *(Encoded as FR-11 + Assumption.)*
- Q: A cashier has a **legacy** clerk-keyed PIN row (pre-019/017) but no neutral-keyed row — for FR-5's create-only "already exists" check, does the legacy row count as existing? → A: **Yes — the legacy row counts as "exists", so provisioning refuses** and the legacy row is left for 017's re-anchor migration to handle. 019 never creates a second row for the same cashier-on-terminal; it does not upgrade legacy rows in place (that boundary belongs to 017). *(Encoded in FR-5.)*

## User Scenarios & Testing

### Primary User Story

A pharmacy **manager** is onboarding a new cashier on a paired terminal. The cashier appears in the branch roster but has no PIN on this terminal yet. The manager selects that cashier, enters an initial PIN, and confirms. The terminal creates the cashier's local unlock record — sealed, scoped to this terminal, and keyed on the cashier's durable provider-neutral identity — and records an auditable "PIN provisioned" event attributable to the manager. The cashier can now unlock this terminal offline with that PIN. The PIN value itself never leaves the device.

### Acceptance Scenarios

1. **First-time provisioning succeeds**
   - **Given** a manager is signed in on a paired terminal, and a rostered cashier has **no** existing PIN record on this terminal
   - **When** the manager provisions that cashier with a valid initial PIN
   - **Then** a new local unlock record is created for the cashier, keyed on the cashier's provider-neutral identifier, sealed at rest, scoped to this terminal; an auditable provisioning event attributed to the manager is recorded; and the cashier can subsequently unlock the terminal with that PIN.

2. **Provisioning is role-gated**
   - **Given** a **cashier** (not manager/admin) is the active operator
   - **When** they attempt to provision any cashier's PIN
   - **Then** the action is refused generically (no detail leaked), and no record is created or modified.

3. **Already-provisioned cashier is not silently overwritten by the provisioning path**
   - **Given** a rostered cashier **already has** a PIN record on this terminal
   - **When** a manager invokes *provisioning* (first-time create) for that cashier
   - **Then** the system does not create a duplicate or silently replace the secret; the manager is directed to the existing **reset** path instead (provisioning is create-only; reset remains the change-an-existing-PIN path).

4. **Provider-neutral key at creation**
   - **Given** a cashier whose roster entry carries a provider-neutral identifier
   - **When** the manager provisions their PIN
   - **Then** the created record's identity key is the **provider-neutral identifier**, not the provider-coupled Clerk subject — so no later re-key migration is required for rows created through this path.

5. **Secret never surfaces**
   - **Given** any provisioning attempt (success, refusal, or failure)
   - **When** the operation completes
   - **Then** the PIN value, its hash, and its salt never appear in any log line, audit payload, error message, or renderer-visible response.

### Edge Cases

- **Roster entry lacks a provider-neutral identifier** (a cashier not yet mapped upstream): provisioning **refuses** with a truthful "this cashier isn't ready to provision yet" state (Q1 → A). It MUST NOT fall back to a provider-coupled record (that would re-introduce the coupling this feature removes and create a row needing the 017 migration). Note: until the held DP-2 roster field is live, *every* cashier presents as "not ready" — which is the honest state.
- **Terminal not paired** (no tenant/branch/terminal scope available): provisioning is refused; no record created.
- **Invalid PIN shape** (outside the accepted digit-length policy): refused generically; no record created; the rejected value is never echoed.
- **Provisioning attempted while the upstream roster field is not yet live** (the held DP-2 dependency): the provisioning path is present but cannot complete end-to-end until the roster delivers the identifier; it must fail safe (a truthful "not available" state), never create a mis-keyed or partial record.
- **Concurrent provisioning + reset for the same cashier on the same terminal**: the create-only provisioning path and the change-existing reset path must not race into a duplicate or a lost-update; the terminal-scoped record remains single and consistent.

## Requirements

### Functional Requirements

- **FR-1.** The system MUST provide a manager/admin-attributable action that creates a **new** cashier unlock record on the paired terminal when none exists for that cashier.
- **FR-2.** The created record MUST be keyed on the cashier's **provider-neutral identifier** (the durable identity key, not the provider-coupled subject) from the moment of creation.
- **FR-3.** The cashier's provider-neutral identifier MUST be obtained from the branch **roster** (a delivered attribute of the rostered cashier), not minted locally, not derived from the provider subject, and not fetched on a separate per-provisioning backend call.
- **FR-4.** Provisioning MUST be role-gated to **manager** or **admin**; a cashier-role operator MUST be refused generically.
- **FR-5.** Provisioning MUST be **create-only**: if a record already exists for the cashier on this terminal, the provisioning action MUST NOT create a duplicate or silently replace the existing secret; the existing **reset** path remains the mechanism for changing an already-provisioned PIN. "Already exists" MUST include a **legacy provider-coupled (clerk-keyed) row** for that cashier-on-terminal — provisioning refuses in that case and leaves the legacy row for the 017 re-anchor migration; 019 MUST NOT create a second row for the same cashier-on-terminal, and MUST NOT upgrade a legacy row in place (that is 017's boundary).
- **FR-6.** The PIN secret (hash + salt) MUST be generated locally, sealed at rest, scoped to `(tenant, branch, terminal, provider-neutral identifier)`, and MUST NEVER leave the device, be transmitted upward, or appear in logs/audit/errors/renderer responses.
- **FR-7.** A successful provisioning MUST emit a **secret-free** audit event recording scope + the fact of provisioning + the attributable manager/admin — never the PIN, hash, or salt.
- **FR-8.** The verifier component that checks a PIN at unlock time MUST be unchanged by this feature (it never keys on identity); provisioning only creates the record the verifier later reads.
- **FR-9.** The tenant/branch/terminal scope components of every provisioned record MUST remain present (non-empty) and sourced from the terminal's paired device state, never from the renderer.
- **FR-10.** The feature MUST correct the stale 004 documentation that describes first-PIN provisioning as occurring "via reset", so the documented model matches the actual create path.
- **FR-11.** When a rostered cashier carries **no** provider-neutral identifier, provisioning MUST refuse with a truthful "not ready to provision" state and MUST NOT create any record (Q1 → A). It MUST NOT fall back to keying the record on the provider-coupled subject under any circumstance.

### Non-Functional Requirements

- **NFR-1.** Provisioning MUST complete (record created + audit emitted) within a single, crash-safe local transaction — a mid-operation failure leaves either no record or a complete record, never a partial or unsealed one.
- **NFR-2.** A provisioned cashier MUST be able to unlock the terminal **offline** thereafter (no network dependency at unlock time), consistent with the offline-first unlock model.
- **NFR-3.** Coverage on the new provisioning logic MUST meet the project's load-bearing-code bar (≥ 80%; the PIN/operator module already sits in the high-coverage tier), test-first.

## Success Criteria

- **SC-1.** A manager can provision a never-before-provisioned cashier and that cashier can then unlock the terminal — a flow that is **impossible today** — with no PIN value ever observable outside the device.
- **SC-2.** 100% of records created through this path are keyed on the provider-neutral identifier, so the 017 re-anchor migration needs to touch **zero** rows created after this feature ships (it becomes a legacy-only safety net).
- **SC-3.** A cashier-role operator attempting to provision is refused in 100% of cases with no information leak.
- **SC-4.** Attempting to provision an already-provisioned cashier never produces a duplicate record or a silently replaced secret.
- **SC-5.** No PIN, hash, or salt appears in any audit event, log line, error, or renderer response across all provisioning paths (verified by the canonical redaction test extended to this path).

## Key Entities

- **Cashier unlock record** — the existing per-terminal, sealed local record (`cashier_pin_records`) holding the Argon2id hash/salt + lockout state. This feature adds its **create** path and changes its identity key to the provider-neutral identifier at creation. No new entity is introduced.
- **Rostered cashier** — the branch-roster representation of a cashier (display identity + role). This feature consumes a **provider-neutral identifier attribute** of that entry (an upstream-delivered field; see Dependencies).

## Assumptions

- The accepted PIN shape (digit length / policy) is the **same** as the existing reset path's policy; this feature does not redefine PIN complexity (that is a separate, carried 004 open question).
- Provisioning is a **manual manager/admin action** (mirroring the existing reset action's trigger), not an automatic background process.
- "Provider-neutral identifier" is the durable identity key already defined by the platform's identity boundary (028 §16, = the backend `users.id`); this feature consumes it as an opaque string and does not define or resolve it.
- The provisioning UI surface reuses the existing cashier-management surface that already hosts reset/unlock; no new top-level navigation is introduced.
- Lockout state on a freshly provisioned record starts clear (zero failures, not locked).
- **Unmapped cashier → refuse (Q1 → A, owner-decided 2026-06-13).** When a rostered cashier has no provider-neutral identifier, provisioning refuses cleanly rather than deferring or falling back to a provider-coupled key. Rationale: it keeps every created row strictly born-neutral (preserving SC-2), and it composes with the held DP-2 dependency — pre-DP-2, all cashiers correctly present as "not ready", which is the truthful state. Deferred-queue (Option B) is a possible v2 enhancement, explicitly out of scope here.

## Out of Scope

- **The 017 offline-PIN re-anchor itself** (re-keying *existing* legacy rows; migration `0035`). This feature makes *new* rows born-neutral; 017 handles any legacy rows.
- **The DP-2 roster change** that surfaces the cashier's provider-neutral identifier on the wire (an upstream Data-Pulse-2 slice; this feature consumes it, does not author it — Constitution P16).
- **Cashier self-service PIN provisioning or rotation** (remains manager/admin-attributable only, per 004's boundary).
- **PIN complexity / retry-lock policy changes**, VAT/fiscal, sale sync, and any backend write of PIN material (none — PIN stays local).
- **Retiring the provider-coupled bridge column** (a later, separately-gated decision).

## Dependencies

- **Upstream (held): Data-Pulse-2 must surface the cashier's provider-neutral identifier on the branch roster.** Verified as a small additive change (the identifier is already loaded server-side at the roster query). Per the 017 sequencing decision (Fork 1), this DP-2 slice is specified **after** this feature exists, so the two land coordinated. This feature is designed and built to **consume** that roster attribute; its end-to-end completion waits on the field going live, but the create-path, role-gate, sealing, audit, and tests are buildable against a fixture roster that carries the identifier.
- **Sibling / downstream: feature 017 (offline-PIN re-anchor)** depends on this feature — born-neutral rows are what let 017's migration be a legacy-only safety net. See [`../017-offline-pin-reanchor/UNBLOCK-PLAN.md`](../017-offline-pin-reanchor/UNBLOCK-PLAN.md) (this is Step 2 of its 2→1→3 sequence) and [`../017-offline-pin-reanchor/OUTBOX-DP2-cashier-user_id.md`](../017-offline-pin-reanchor/OUTBOX-DP2-cashier-user_id.md).
- **Predecessor: feature 004 (operator session)** owns the existing unlock record, the reset/unlock paths, the role-gate, and the sealing/verifier components this feature extends.

## Open Questions

- (none — Q1 resolved to **Option A: refuse** on 2026-06-13; see Assumptions and FR-11.)

---

*Constitution alignment:* This spec MUST satisfy the principles of `.specify/memory/constitution.md` (v1.5.1 at time of writing) — notably Principle VIII (Terminal Identity ≠ User: anchoring on the provider-neutral key strengthens it), the secret-locality rules (PIN never leaves device), Principle VI (offline-first unlock), and P16 (this feature authors no upstream). The plan and tasks artifacts will perform the explicit "Constitution Check."

# Roadmap & Ops Status — POS-Pulse 004-operator-session

**Snapshot date:** 2026-05-09 (initial); reconciled 2026-05-11 post-PRs #120/#121/#122 — S4 implementation through T082 complete; T056 remains blocked/deferred by issue 101; issue 85 closed; issues 86/87/101 open; 005 blocked behind §A0
**Author:** Read-only ops review agent (initial); updated by docs(004) PR on 2026-05-09; reconciled by docs/004-s4-closeout-coordination PR on 2026-05-11
**Scope:** Read-only audit of GitHub roadmap, PR/issue state, and gate alignment for `specs/004-operator-session`. **No issue edits performed in the original snapshot.** §9 and issue table updated to reflect PR #100 merge and issue hygiene (issues #85 and #101 reopened).

> Advisory only. Every recommendation in §8 ("Recommended issue-body updates") is **awaiting maintainer approval before any edit**.

---

## 1. Repo summary

| Field | Value |
|:--|:--|
| Default branch | `main` |
| Current `main` HEAD SHA | `f83be6313d90b37333ce315ffb203585086898cf` |
| Latest commit subject | `Merge pull request #95 from ahmed-shaaban-94/docs/repo-readme-assets-refresh` |
| Working branch (this session) | `feat/004-s4-cashier-sign-in-T069` (already merged via PR #94 — safe to delete locally and on origin once owner confirms) |

### Untracked items at repo root (informational only — not modified)

| Path | Note |
|:--|:--|
| `..codex-docs-assets-beautification.patch` | Patch file left at repo root. Outside the scope of this review. Not touched. |
| `AGENTS.md` | Intentionally excluded from commits per parent agent's instructions. Not touched. |

### Stale local branches still present (no deletes recommended in this report)

Local-only branches that still exist locally (not on origin) — informational only:

- `claude/determined-pike-38b11a`
- `claude/wizardly-bartik-c5f13f`
- `feat/foundation-phase-1-2`
- `feat/foundation-phase-3-us1`
- `tmp/integration-us6-us3`
- `tmp/us3-rebase`
- `worktree-agent-a2760dc34245658d6`
- `worktree-agent-a291a0ca5a8933746`
- `worktree-agent-a9b8d9d4243b741bd`
- `worktree-agent-ad2149f2726a10fd6`

Local branches that are also on origin and may be cleanup candidates after their PRs merged:

- `feat/004-s4-cashier-sign-in-T069` — PR #94 MERGED 2026-05-08 (this session's HEAD branch).
- `feat/003-us3-state-variants` — historical S3 work.
- `feat/003-us6-checkout-reservation` — historical S3 work.
- `docs/004-s2-bridge-security-review` — PR #47 MERGED 2026-05-06.
- `claude/pensive-poitras-1c0864` — PR #48 MERGED 2026-05-06.

> Recommendation: do NOT auto-delete. Owner should confirm each branch individually.

---

## 2. GitHub Project / Roadmap status

`gh project list --owner ahmed-shaaban-94` returned three accessible projects:

| # | Title | State |
|:-:|:--|:--|
| 4 | POS-Pulse Roadmap — 004 Operator Session | open |
| 5 | POS-Pulse Roadmap | open |
| 6 | Data-Pulse-2 Roadmap | open |

### Project board #4 — POS-Pulse Roadmap — 004 Operator Session (legacy slice tracker)

Items (10 total). The status column reflects the project board's per-item status; the `state` column on the actual GitHub issue may be open/closed independently.

| Item | Title | Project status |
|:--|:--|:--|
| #65 | S4: PIN credential verifier foundation | Done |
| #66 | S4: PIN lockout and per-terminal scope | Done |
| #67 | S4: safeStorage seal for local PIN-sensitive handling | Done |
| #68 | S4: Cashier sign-in handler | Done |
| #69 | S4: Takeover confirm handler | Done |
| #70 | S4: PinPad and TakeoverPrompt UI activation | Done |
| #71 | S4: Closeout and coordination update | Done |
| #72 | S5: Blind shift close and cashier visibility boundaries | Todo |
| #73 | S6+: Deferred POS business flows | Done |
| PR #64 | feat(004): S4 active-session handler — T069a + T069b | Done |

> ⚠ Inconsistency: items #65–#71 are all marked **Done** on board #4, yet the **same-titled** issues #82–#87 on board #5 (the canonical roadmap) and on the issue tracker show **closed** for #82/#83/#84 and **open** for #85/#86/#87. Board #4 appears to be a legacy mirror that needs a manual sweep — do not let it drift further. (Advisory; no edits performed.)

### Project board #5 — POS-Pulse Roadmap (canonical roadmap)

Sampled top items (output is large; only 004-relevant rows reproduced):

| Issue | Title | Roadmap Status | Work Type |
|:-:|:--|:--|:--|
| #74 | 001-foundation — completed | Done | Docs |
| #75 | 002-terminal-pairing — completed | Done | Docs |
| #76 | 003-pos-ui-shell — completed | Done | Docs |

The 004-operator-session issues #77–#89 also live on board #5; their per-issue status is reported in §4 below from the canonical issue API.

---

## 3. Gate state cross-check vs `coordination.md`

`specs/004-operator-session/coordination.md` (last updated 2026-05-08) records:

| Gate | Coordination.md state | Verifiable via PR/issue data | Match? |
|:--|:--|:--|:--:|
| Slice 0 review (FR-033) | ✅ approved-with-revisions 2026-05-05 | Recorded in `visual-direction/README.md` Review Record (not re-verified here). | ✅ |
| §A1 — local-unlock-factor approval | ✅ Cleared — PR #39, SHA `7ae337b`, Constitution v1.5.1, 2026-05-05 | PR #39 not in last 30 PRs (older); coordination.md is the durable record. | ✅ (taken on faith) |
| §A2 Wave 1 (sign-in/sign-out) | ✅ Cleared — Data-Pulse-2 PRs #52/#54 | Backend repo; out-of-scope to verify here. | ✅ |
| §A2 Wave 2 (audit-events) | ✅ Cleared — Data-Pulse-2 PR #62 | Backend repo. | ✅ |
| §A2 Wave 3 (roster + takeover/confirm + active-session) | ✅ Cleared — Data-Pulse-2 PR #70 | Backend repo. | ✅ |
| §A2 Wave 4 (`shift.forced_close`) | ⏳ Held | Backend repo — not delivered yet. | ✅ |
| §A3 — migrations | ✅ Cleared — POS-Pulse PRs #49 (`audit_events`) + #60 (`operator_sessions` + `cashier_pin_records`) | PR #60 MERGED 2026-05-07T14:07:39Z. ✅ confirmed. | ✅ |
| §A4 — Argon2id binding | ✅ Cleared — POS-Pulse PR #59 (`argon2 0.44.0`) | PR #59 MERGED 2026-05-07T14:09:08Z. ✅ confirmed. | ✅ |
| §A5 — production readiness | ⏳ Later rollout gate | Activates at production rollout PR. | ✅ |

**No mismatches detected.** Coordination.md and `gh` data are consistent. The §A1 and §A2 Wave 1/2 PR pointers reference older / cross-repo PRs that fell outside this session's `gh pr list --limit 30` window — they are taken from coordination.md as the durable record.

> ℹ **Updated (2026-05-11):** S4 implementation through T082 is now complete. PRs #120 (T061/T062/T072/T073), #121 (T057–T060), and #122 (T078–T082) have all merged. T056 remains blocked/deferred by issue 101 (terminal-A session-invalidation gap — UX gap, not a security gap). Issue 85 closed. Issues 86, 87, and 101 remain open. Coordination.md and tasks.md have been reconciled by the docs/004-s4-closeout-coordination PR (issue 87). 005 remains blocked behind §A0. Final S4 checkpoint / S5 unblock held pending issue 101 resolution or explicit owner waiver.

---

## 4. Issue-by-issue status (feature:004-operator-session)

### S4 wave (focus of this audit)

| # | Title | State | Labels | Assignee | Milestone | Depends on (gates) | Blocking / unblocking notes |
|:-:|:--|:--|:--|:--|:--|:--|:--|
| **#84** | 004 S4 — cashier sign-in handler | **CLOSED** (2026-05-08) | type:feature, status:ready, feature:004-operator-session | — | — | §A1 ✅, §A2 Wave 3 ✅, §A3 ✅, §A4 ✅ | PR #94 covered T069 cashier sign-in handler (main-process only). Depends on T069a + T069b (PR #64). |
| **#85** | 004 S4 — takeover confirm handler | **CLOSED (2026-05-11, AD-2 decision)** | type:feature, status:ready | — | — | §A1 ✅, §A2 Wave 3 ✅ | T070 + T071 manager/admin path merged via PR #100 (SHA `deb689a`). Cashier-path AD-2 decision recorded 2026-05-11: cashier takeover confirm is permanently local-only; `BackendClient.confirmTakeover` excluded for cashier path under AD-2. See `coordination.md` §"Issue 85 decision". |
| **#86** | 004 S4 — PinPad and TakeoverPrompt UI activation | **OPEN, ready** | type:feature, status:ready | — | — | §A1 ✅, §A2 Wave 3 ✅; depends on #85 main-process surface AND a `CashierSignInRequest` bridge-type addition | Implements T074 (PinPad), T075 (cashier-path activation on `sign-in.tsx`), T076 (TakeoverPrompt), T077 (renderer takeover wiring). **Hard prerequisite: #85 must merge first.** **Soft prerequisite: bridge type export (see §7c below).** |
| **#87** | 004 S4 — closeout and coordination update | **OPEN, ready** | type:docs, status:ready | — | — | All S4 implementation PRs merged | Updates `tasks.md` + `coordination.md`; records validation status; documents remaining S5 blockers. **Hard prerequisite: all earlier S4 PRs merged.** |

### S5 wave (blocked)

| # | Title | State | Labels | Assignee | Milestone | Depends on (gates) | Blocking / unblocking notes |
|:-:|:--|:--|:--|:--|:--|:--|:--|
| **#88** | 004 S5 — blind shift close and visibility boundaries | **OPEN, blocked** | type:feature, **status:blocked**, feature:004-operator-session | — | — | S4 completion + §A2 Wave 4 (`shift.forced_close` recognition in Data-Pulse-2) | Cannot start until #87 lands and Data-Pulse-2 ships Wave 4. |

### S6+ deferred / future POS flows umbrella

| # | Title | State | Labels | Assignee | Milestone | Depends on | Notes |
|:-:|:--|:--|:--|:--|:--|:--|:--|
| **#89** | Future POS flows — deferred until specs exist | **OPEN, deferred** | type:docs, **status:deferred** (no `feature:004` label) | — | — | spec authoring | Umbrella for sales/cart, payments, tender, receipts, inventory mutation, reports/KPIs/analytics. **Do not implement yet.** Note: #89 deliberately lacks the `feature:004-operator-session` label because it is future / not part of 004. |

### Closed earlier-S4 issues (for completeness)

| # | Title | State | Closed via |
|:-:|:--|:--|:--|
| #77 | 004 S1 — manager/admin sign-in completed | CLOSED | PR #46 |
| #78 | 004 S2 — bridge/security review completed | CLOSED | PR #47 |
| #79 | 004 S3 — audit scaffold and lifecycle completed | CLOSED | PRs #49–#56 |
| #80 | 004 S4 gates and backend-client foundation completed | CLOSED | PRs #59 + #60 + #61 |
| #81 | 004 S4 — PIN credential verifier foundation | CLOSED | PR #90 |
| #82 | 004 S4 — PIN lockout and per-terminal scope | CLOSED | PR #92 |
| #83 | 004 S4 — safeStorage seal for local sensitive handling | CLOSED | PR #93 |

---

## 5. PR status

### PRs in last `gh pr list --limit 30` window (most recent first)

| # | Title | State | Head branch | Merged at | Notes |
|:-:|:--|:--|:--|:--|:--|
| **#100** | feat(004-s4): T070 + T071 — takeover confirm/cancel | **MERGED** | `feat/004-s4-takeover-confirm-T070-T071` | **2026-05-09T14:03:26Z** | T070 + T071 (manager/admin path). Related to #85, #101. Does not close #85 or #101. |
| #95 | docs: refresh repository README and assets | MERGED | `docs/repo-readme-assets-refresh` | 2026-05-08T22:29:31Z | Non-004 docs polish. |
| **#94** | feat(004): S4 cashier sign-in handler — T069 | **MERGED** | `feat/004-s4-cashier-sign-in-T069` | **2026-05-08T22:17:02Z** | Closes #84. T069. |
| #93 | feat(004): S4 safeStorage seal for cashier_pin_records rows — T068 | MERGED | `feat/004-s4-pin-seal-T068` | 2026-05-08T21:19:07Z | Closes #83. T068. |
| #92 | feat(004): S4 PIN lockout + per-terminal scope — T054 + T055 + T067 | MERGED | `feat/004-s4-pin-lockout-scope` | 2026-05-08T19:00:46Z | Closes #82. T054/T055/T067. |
| #91 | ci: rebuild argon2 for test and Electron ABIs | MERGED | `ci/native-argon2-abi-rebuild` | 2026-05-08T17:09:58Z | Native binding ABI fix. |
| #90 | feat(004): S4 PIN credential verifier foundation — T052 + T053 + T066 | MERGED | `feat/004-s4-pin-credential-foundation` | 2026-05-08T18:11:32Z | Closes #81. T052/T053/T066. |
| #64 | feat(004): S4 active-session handler — T069a + T069b | MERGED | `feat/004-s4-active-session-handler` | 2026-05-08T15:06:54Z | Internal-only handler; consumed by T069. |
| #63 | feat(004): S4 roster handler — T070a + T070b | MERGED | `feat/004-s4-roster-handler` | 2026-05-08T13:54:39Z | T070a/T070b. |
| **#62** | ci: upload Vitest coverage to Codecov | **OPEN** | `ci/codecov-coverage` | — | Unrelated to 004. **Note:** coverage gates may shift once it lands. |
| #61 | feat(004): S4 Wave 3 backend-client — roster, takeover-confirm, active-session | MERGED | `feat/004-s4-backend-client-wave3` | 2026-05-08T13:34:13Z | Backend-client extension. |
| #60 | feat(004): §A3 S4 migrations — operator_sessions + cashier_pin_records | MERGED | `feat/004-s4-operator-pin-migrations` | 2026-05-07T14:07:39Z | T064/T065. §A3. |
| #59 | chore(004): install argon2 0.44.0 — §A4 gate (T063) | MERGED | `chore/004-s4-install-argon2` | 2026-05-07T14:09:08Z | T063. §A4. |
| #58 | docs(process): add optional POS-Pulse governance templates (phase 1) | MERGED | `docs/pos-pulse-governance-templates-phase-1` | 2026-05-07T12:35:23Z | Process docs. |
| #57 | docs(004): S3 close-out status — tasks + coordination | MERGED | `docs/004-s3-closeout-status` | 2026-05-07T11:35:34Z | S3 closeout. |
| #56 | test(004): S3 audit durability + sync integration — T042 + T043 | MERGED | `test/004-s3-audit-durability-sync` | 2026-05-07T10:52:49Z | S3 tests. |
| #55 | feat(004): S3 lifecycle cascade — T051a–T051d FR-014 + account-disabled | MERGED | `claude/stupefied-napier-188dc9` | 2026-05-07T10:25:45Z | S3 lifecycle. |
| #54 | feat(004): S3 debug bridge smoke — T051 operator._emitAuditEventSmoke | MERGED | `feat/004-s3-audit-bridge-smoke` | 2026-05-07T09:52:19Z | S3 smoke. |
| #53 | feat(004): S3 audit bridge wiring — T048 operator.emitAuditEvent | MERGED | `feat/004-s3-audit-bridge-wiring` | 2026-05-07T09:14:41Z | T048. |
| #52 | feat(004): S3 redaction extension — T050 audit payload defence-in-depth | MERGED | `feat/004-s3-audit-redaction` | 2026-05-07T08:39:56Z | T050. |
| #51 | feat(004): S3 audit sync loop — T047 outbox → Data-Pulse-2 | MERGED | `feat/004-s3-audit-sync-loop` | 2026-05-07T07:55:06Z | T047. |
| #50 | feat(004): S3 audit emitter bootstrap — T039 T040 T041 T044 T046 | MERGED | `feat/004-s3-audit-emitter-impl` | 2026-05-07T07:17:10Z | S3 emitter. |
| #49 | feat(004): §A3 gate — audit_events migration (T045) | MERGED | `feat/004-s3-audit-events-migration` | 2026-05-07T05:59:26Z | T045. §A3 audit_events table. |
| #48 | feat(004): S2 follow-up (F-01) + S3 prep — bridge surface + audit payload schemas | MERGED | `claude/pensive-poitras-1c0864` | 2026-05-06T21:11:00Z | S2 follow-up + S3 prep. |
| #47 | docs(004): S2 bridge-surface security review — approved-with-revisions | MERGED | `docs/004-s2-bridge-security-review` | 2026-05-06T20:41:23Z | S2 review. |
| #46 | feat(004): S1 operator sign-in — manager/admin Clerk path | MERGED | `feat/004-s1-operator-signin` | 2026-05-06T13:27:19Z | S1 main. |
| #45 | docs(004): mark Backend Wave 1 available | MERGED | `docs/004-backend-wave1-available` | 2026-05-06T11:40:46Z | Wave 1 marker. |
| #44 | docs(004): align POS endpoint namespace with backend | MERGED | `004-pr0-pos-namespace` | 2026-05-06T06:55:03Z | Namespace align. |
| #43 | docs(004): align Wave 1 sign-in contract with Clerk JWT | MERGED | `004-b1-sign-in-clerk-jwt` | 2026-05-06T06:17:41Z | Wave 1 contract. |
| #42 | docs(004): assign §A2 backend owner | MERGED | `004-a2-owner-assigned` | 2026-05-05T22:24:56Z | §A2 owner doc. |
| #41 | docs(004): add §A2 backend handoff | MERGED | `004-a2-backend-handoff` | 2026-05-05T22:11:14Z | §A2 handoff doc. |

### Detailed view of PR #94 (the most recent S4 PR)

| Field | Value |
|:--|:--|
| State | MERGED |
| Mergeable | UNKNOWN (post-merge) |
| Head ref | `feat/004-s4-cashier-sign-in-T069` |
| Title | feat(004): S4 cashier sign-in handler — T069 |
| Merged at | 2026-05-08T22:17:02Z |
| Closed at | 2026-05-08T22:17:02Z |
| URL | https://github.com/ahmed-shaaban-94/POS-Pulse/pull/94 |

### Local commit timeline (since 2026-05-01) — confirms PR merges

`git log --oneline --all --since='2026-05-01' -n 30` shows the post-2026-05-01 history is consistent with the PR merge order above. The merge commits for #94, #93, #92, #91, #90, #64, #63, #61, #60, #59 are all present on `main`. No drift detected.

---

## 6. (Empty — see §3 for gate cross-check)

This planning artifact's §3 contains the gate state cross-check; this slot is intentionally left empty so §-numbering aligns with the deliverable spec given to the agent.

---

## 7. Recommended next implementation order

Each step is marked with its prerequisite. Execute top-down. Steps 7c and 7b may be folded into a single PR if the maintainer prefers.

### 7a. Resolve T069c — terminal-A notification-mechanism decision

**Prerequisite:** none (decision task only; produces a `research.md` §3 addendum, no code).
**Output:** documented decision (passive polling vs active push) for how terminal A learns its session was superseded.
**Why first:** T070 (and therefore issue #85) explicitly depends on T069c. Without the decision, takeover-confirm wiring would commit to a notification model prematurely.
**Form:** small standalone docs PR, OR fold into 7b's PR description as the first commit.

### 7b. Issue #85 — takeover confirm + cancel handlers (T070 + T071)

**Status (2026-05-11):** T070 + T071 manager/admin path **MERGED** via PR #100
(SHA `deb689a`). Issue #85 **CLOSED** — cashier-path AD-2 decision recorded
2026-05-11 (docs-only PR off `docs/004-issue-85-cashier-takeover-ad2-decision`).

**Decision:** Cashier takeover confirm is permanently local-only under AD-2.
`BackendClient.confirmTakeover` is never called for the cashier path. This is
an architectural invariant. Full decision record in
`specs/004-operator-session/coordination.md` §"Issue 85 decision".

~~The remaining work for #85 is the cashier-path resolution: either (a)
document that cashier takeover-confirm is fully local (AD-2 confirmed,
no backend call ever), closing #85 with a docs-only PR, or (b) resolve
the Endpoint 4 JWT requirement discrepancy (see `planning/takeover-confirm-plan.md`
§5 and §11 Risk #3).~~

**Prerequisite for original scope (now complete):** 7a (T069c — passive
polling decision recorded in `takeover-handler.ts` class-level JSDoc).

### 7c. Bridge type export — `CashierSignInRequest` on the public `SignInRequest` discriminated union

**Prerequisite:** PR #94 already merged.
**Finding (verified 2026-05-09):** `src/shared/bridge-api.ts` line 118 still defines:

```
export type SignInRequest = ManagerAdminSignInRequest;
```

The cashier branch type lives only inside `src/main/operator/sign-in-handler.ts` (lines 207–229: `CashierSignInRequest`, `CashierSignInHandler`). It is **NOT** exported on the bridge surface. Comment on line 108 still reads "the cashier branch `{ kind: 'cashier'; ... }` is §A1-gated and added in S4."

**Action:** when 7d (UI activation) is ready to call `operator.signIn` with the cashier branch from the renderer, the bridge type union must be widened to:

```
export type SignInRequest = ManagerAdminSignInRequest | CashierSignInRequest;
```

with `CashierSignInRequest` re-exported (or duplicated minimally) from `src/shared/bridge-api.ts`. Renderer code MUST NOT import from `src/main/*`. May fold into 7b or 7d.

**Why this matters:** the renderer cannot today type-check a cashier sign-in call across the bridge — the public bridge surface refuses it. Without this, 7d (issue #86) cannot land cleanly.

### 7d. Issue #86 — PinPad + TakeoverPrompt UI activation

**Prerequisite:** 7b merged (manager/admin path — ✅ PR #100) AND 7c merged
(or both folded into 7b). The cashier-path remainder of #85 does NOT block
#86's terminal-B UI work.

**#101 constraint (2026-05-09 decision — see `coordination.md` §"Takeover
follow-up classification before UI"):**
- **#86 MAY proceed** with PinPad + TakeoverPrompt terminal-B UI activation.
- **#86 MUST NOT** include a passing T056 integration-test assertion that
  "terminal A returns to `/sign-in` within 30 seconds." That assertion is
  architecturally blocked by #101 (each Electron process has independent
  in-memory `SessionManager`; terminal B's `confirmTakeover` cannot push a
  sign-out to terminal A's process). Screenshot acceptance criteria for #86
  are terminal-B-only.
- Full S4 takeover flow CANNOT be marked complete in #87 closeout until #101
  is resolved or explicitly waived.

**Scope:** T074 (PinPad component), T075 (cashier-path activation on
`src/renderer/routes/sign-in.tsx`, calls `operator.signIn` cashier variant;
uses `operator.listBranchRoster` from PR #63), T076 (TakeoverPrompt modal),
T077 (renderer takeover wiring: `signingIn` → `takeover_required` →
`takeoverPrompt`; calls `operator.confirmTakeover`/`operator.cancelTakeover`).
**Closes:** #86 (with explicit acknowledgment that T056 terminal-A assertion
is deferred to #101 resolution).

### 7e. Remaining S4 tasks — **COMPLETE (2026-05-11)**

All S4 implementation tasks through T082 have been completed:

- **T072** ✅ — `operator.resetCashierPin` — PR #120.
- **T073** ✅ — `operator.unlockCashier` — PR #120.
- **T078** ✅ — manager-only cashier-management surface — PR #122.
- **T079** ✅ — stuck-shift badge row added to `role-visibility-matrix.md` — PR #122.
- **T080** ✅ — navigation count badge (placeholder data source) — PR #122.
- **T081** ✅ — `pino` log sites + PR-1 redaction for PIN operations — PR #122.
- **T082** ✅ — route-guard updated for §Section 3 routes — PR #122.
- **T057–T062** ✅ — takeover-cancel integration, FR-013 disclosure guard, cashier sign-in AppRouter, PinPad privacy, PIN reset/unlock integration tests — PRs #121/#120.

**Remaining:** T056 — blocked/deferred by issue 101 (terminal-A session-invalidation gap — UX gap, not security gap). T056 must not be marked complete or implemented until issue 101 is resolved or explicitly waived by owner decision.

### 7f. Issue #87 — S4 closeout & coordination update — **IN PROGRESS (docs/004-s4-closeout-coordination, 2026-05-11)**

**Scope:** docs only. Updates `tasks.md` (T078–T082 marked complete; T056 preserved as blocked/deferred by issue 101; S4 checkpoint and dependency diagram reconciled), `coordination.md` (S4 implementation closeout status section added; explicit non-actions updated; Last updated bumped), and this file (S4 task status reconciled in §3, §7e, §7f). No source code, tests, migrations, package.json, CI, or Data-Pulse-2 changes. No S5 work. No 005/006 work.
**Note:** issue 87 remains open — this PR is its resolution; it should not be closed until the PR merges per owner workflow.

### 7g. §A2 Wave 4 backend coordination

**Prerequisite:** 7f merged.
**Scope:** in this repo, only the codegen pull side: `npm run codegen:api` after Data-Pulse-2 ships Wave 4 (recognition of `shift.forced_close` audit category). **Cannot modify Data-Pulse-2 from this repo.** Separately, the Data-Pulse-2 owner ships the backend feature.
**Output:** updated `src/shared/api-types.ts`; `npm run codegen:verify` clean.

### 7h. Issue #88 — S5 forced-close surface

**Prerequisite:** 7f + 7g.
**Scope:** S5 implementation per `tasks.md` Phase 7 (T083–T089 in the visible portion of tasks.md); blind-close discipline (no drawer count display, no expected total, no variance surfaced to cashier); `operator.forceCloseShift` handler with manager/admin role gate and same-branch verification (P17); `shift.forced_close` audit event with both identities and structured reason picker.
**Closes:** #88.

### 7i. S6 polish + §A5 production-readiness rollout

**Prerequisite:** 7h merged + all earlier S4/S5 issues closed.
**Scope:** S6 polish per `tasks.md` Phase 8 (not enumerated in this audit). After S6, open the production-rollout PR which activates §A5 (production readiness gate). The §A5 owner is assigned at rollout-PR-open time per coordination.md §6.

---

## 8. Recommended issue-body updates

> **Advisory; awaiting maintainer approval before any edit. NO ISSUES MODIFIED IN THIS SESSION.**

The following body-text additions would improve clarity. Each entry shows the exact text the maintainer might paste, prefixed with "**Add to body:**". The maintainer alone decides whether to apply.

### Issue #85 — 004 S4 — takeover confirm handler

**Add to body (under existing scope, before "Out of scope"):**

```
Hard prerequisite: T069c — terminal-A notification-mechanism decision must
be recorded in research.md §3 addendum BEFORE this task's PR opens. The T070
implementation MUST follow the documented decision (passive polling vs
active push). Without T069c, this issue cannot be completed.

Task IDs: T070, T071. Calls BackendClient.confirmTakeover (PR #61) and
emits operator.session.takeover audit event via T046 (PR #50).
```

### Issue #86 — 004 S4 — PinPad and TakeoverPrompt UI activation

**Add to body (under existing scope):**

```
Hard dependency: issue #85 (takeover confirm handler) MUST be merged first.
Soft dependency: src/shared/bridge-api.ts must export CashierSignInRequest
on the SignInRequest discriminated union. As of 2026-05-09 the bridge
type is still ManagerAdminSignInRequest only; widen to
`SignInRequest = ManagerAdminSignInRequest | CashierSignInRequest`
either as part of #85 or in a one-line bridge-type PR before this issue
opens.

Task IDs: T074, T075, T076, T077. Activates cashier path on
src/renderer/routes/sign-in.tsx; consumes operator.listBranchRoster
(PR #63) and operator.signIn cashier variant (PR #94).
```

### Issue #87 — 004 S4 — closeout and coordination update

**Add to body:**

```
Closeout checklist when run:
- [ ] tasks.md marks T070, T071, T072, T073, T074, T075, T076, T077,
      T078, T079, T080, T081, T082 as complete
- [ ] coordination.md "Last updated" line bumped
- [ ] S4 validation table recorded (typecheck, lint, vitest --coverage,
      codegen:verify all clean)
- [ ] No scope creep into sales/cart/payments/reports/inventory verified
- [ ] Remaining S5 blockers documented: S4 complete ✅ + §A2 Wave 4 ⏳
```

### Issue #88 — 004 S5 — blind shift close and visibility boundaries

**Add to body (clarify Wave-4 dependency):**

```
Specific blocker: Data-Pulse-2 must recognise the `shift.forced_close`
audit-event category as part of §A2 Wave 4 (Endpoint 5 extension).
Tracked in coordination.md §3 ("Wave 4"). The cashier PIN factor still
introduces ZERO new backend endpoints (AD-2 invariant from §A1).
```

### Issue #89 — Future POS flows — deferred until specs exist

**No body edit recommended.** Issue is correctly labelled `status:deferred` and lacks the `feature:004-operator-session` label by design (it is *future*, not 004). Leave as-is.

---

## 9. Cross-cutting risks

| # | Risk | Severity | Mitigation |
|:-:|:--|:--|:--|
| 1 | Local branch `feat/004-s4-cashier-sign-in-T069` already merged via PR #94. Stale local branch + remote branch still exist. | Low | Owner confirms, then `git branch -d feat/004-s4-cashier-sign-in-T069` and (separately) `git push origin --delete feat/004-s4-cashier-sign-in-T069`. **Do not auto-delete.** |
| 2 | PR #62 (Codecov coverage CI) is OPEN and unrelated to 004. | Low | One-line note: coverage gates may shift once it lands; ensure S4/S5 PRs do not regress coverage below the threshold #62 introduces. |
| 3 | §A1 amendment was anchored to **Constitution v1.5.1** (PR #39, SHA `7ae337b`). Every future planning artifact must cite this version. | Medium | Future plans, ADRs, and slice specs must reference v1.5.1 (not v1.3.0) when invoking the §A1 local-unlock-factor clarification. coordination.md already does. |
| 4 | Project board #4 ("POS-Pulse Roadmap — 004 Operator Session") shows items #65–#71 as Done while the canonical issue tracker (#82–#87 mirrors) shows three of them OPEN. The board appears to be a legacy mirror. | Medium | Owner sweeps board #4 at next 004 closeout, OR archives it if board #5 is the canonical roadmap. **Advisory only — not edited here.** |
| 5 | T079/T080 ("stuck-shift count badge") have a cyclic dependency: visibility row + badge component live in S4, but the count data feed lives in S5. | Medium | Owner picks: ship T080 with a placeholder `0` source and let S5 wire the live count, OR defer T080 to S5. Document the choice when 7d/7e ships. |
| 6 | `CashierSignInRequest` is defined in `src/main/operator/sign-in-handler.ts` (main-process scope) but **NOT** exported on the public bridge surface (`src/shared/bridge-api.ts` line 118 still says `SignInRequest = ManagerAdminSignInRequest`). The renderer cannot type-check a cashier sign-in call today. | High (UI-blocking) | Widen the bridge type union as part of 7b or 7c before issue #86 opens. |
| 7 | Coordination.md still narrated "S4 implementation begun (2026-05-08). Remaining S4 tasks (T052–T082) in progress." — stale as of 2026-05-09. | Low | Updated by docs(004) PR (this file). `coordination.md` also updated. |
| 8 | **Issue #101 (terminal-A session-invalidation gap):** Terminal A does **not** currently discover a remote takeover through `GET_CURRENT_SESSION` — that handler returns local `SessionManager` state only and never probes the backend. Terminal A learns its session was superseded only after a backend-authenticated call fails with an auth error, on app restart, or after #101 implements a backend probe, push, or invalidation mechanism. No active push mechanism currently exists. The T056 integration-test happy-path assertion ("terminal A returns to `/sign-in` within 30 s") is architecturally blocked until #101 resolves. Accidentally merging a T056 test with a 30-second terminal-A assertion before #101 lands would produce a flaky or permanently skipped test. | **High** | #86 PR description and screenshot acceptance criteria MUST explicitly exclude terminal-A behaviour. #87 closeout MUST NOT mark full takeover flow complete until #101 resolves or is waived. See `coordination.md` §"Takeover follow-up classification before UI". |

---

**End of roadmap & ops status. Read-only audit; no GitHub state-changing commands run; no source files modified.**

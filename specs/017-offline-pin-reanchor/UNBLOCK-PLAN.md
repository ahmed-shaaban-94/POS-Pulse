# 017 Unblock Plan — sequenced, cross-repo

**Status:** SETTLED ANALYSIS · **Date:** 2026-06-13 · **Repos:** POS-Pulse + Data-Pulse-2
**Source evidence:** [`BLOCKER.md`](./BLOCKER.md) rev. 3 · [`OUTBOX-DP2-cashier-user_id.md`](./OUTBOX-DP2-cashier-user_id.md)

> Outcome of a read-only investigation across both repos. 017 cannot be implemented today, but the blocker is now **fully characterised** and decomposes into three sequenced steps with two owner decision-forks. No code or migration was authored; DP-2 was read-only (Constitution P16).

---

## The blocker in one paragraph

017 re-keys `cashier_pin_records`'s PRIMARY KEY off the provider-coupled `cashier_clerk_user_id` onto the §16 provider-neutral `user_id`. The cashier's `user_id` is delivered **nowhere** on the POS wire today: 033 surfaced `user_id` on `PosOperatorSummary` (the *signing-in operator* — a different principal) but scoped the **cashier roster** out. So gate-1 ("operator sign-in carries `user_id`") is **necessary but not sufficient**. Two distinct gaps remain — one trivial (DP-2), one heavier (POS-internal).

## What is verified true (not hypothesis)

| Fact | Evidence |
|:--|:--|
| Cashier `user_id` is on **no** POS-facing contract | `PosRosterCashierEntry` (DP-2 `pos-operators.openapi.yaml:510`) = `required:[id,display_name,role]`, `id`=Clerk subject |
| The DP-2 fix is ~4 lines, **no provisioning** | `findCashiersByStore` already `JOIN users u ON u.id = m.user_id` (`pos-operators.service.ts:809`); `user_id` **is** `u.id`, already loaded |
| 033 did the identical surfacing for the operator | `specs/033/spec.md`; it touched `PosOperatorSummary` only — roster missed |
| POS has **no** `cashier_pin_records` INSERT anywhere (src **or** test) | grep: the table is referenced only in the 5 `pin-*`/`sign-in` source files; tests mock `prepare().get()`, never insert |
| Cashier-PIN **provisioning** is deferred MVP scope, **not** a bug | `resetCashierPin` refuses on a missing row by design (`pin-management.ts:151`); 004 §A5 = internal/dev MVP. The data-model/quickstart "provision via `cashier.pin.reset`" language is **aspirational/inaccurate**, not contradicted-by-code |
| Enrollment identity is the Clerk subject end-to-end | `ResetCashierPinRequest.target_cashier_id` = "Clerk user id" (`bridge-api.md:509`); `data-model.md:367` "Identity is in Clerk" |

## The three sequenced steps

### Step 1 — DP-2: surface cashier `user_id` on `PosRosterCashierEntry` (~4 lines, no provisioning)
Add `u.id` to the `findCashiersByStore` SELECT + map (`pos-operators.service.ts:806,827`), `user_id` to the DTO (`dto.ts:138`), and `user_id` (`required`, `format: uuid`) to the OpenAPI schema (`pos-operators.openapi.yaml:510`). Mirrors 033 exactly. **No `external_identity_links` lookup** — `users.id` is already loaded.
> **🔱 DECISION FORK 1:** spec this in DP-2 **now** (a real DP-2 feature, e.g. `034`) **vs** leave the [`OUTBOX`](./OUTBOX-DP2-cashier-user_id.md) as the handoff and let the DP-2 owner pick it up. *Recommendation: see "Recommended sequence" below.*

### Step 2 — POS: complete cashier-PIN provisioning, keyed on `user_id` from creation (004 ownership)
Today there is no production INSERT into `cashier_pin_records` (deferred MVP scope). A provision-time write site must exist **and** must key the row on the roster-delivered `user_id` at creation — so the row is born provider-neutral and 017's re-key migration (`0036`) never has to migrate it. Also widen `roster-handler.ts:43`'s allowlist (`{id,display_name,role}`) to thread `user_id` through to that write site, and correct the 004 data-model/quickstart "provision via reset" language. *(Status: POS-019 — this Step 2 — is now MERGED (PR #398): it added the additive `user_id` column as migration `0035` and the born-neutral create path.)*
> **🔱 DECISION FORK 2:** does **017** absorb this provisioning work, or is it a **004 follow-up**? *Recommendation: **004 follow-up** — 017 is the re-anchor of an existing store, not the feature that builds the missing provisioning path (P16 feature-scope discipline). 017 should depend on it, not contain it.*

### Step 3 — 017: the re-anchor itself (migration `0036`) — **IMPLEMENTED on `feat/017-reanchor-impl` (pending 2nd-eyes review + merge)**
**Migration number:** 019 took `0035` (additive `user_id` column, PR #398); 017's PK re-key is **`0036`**.

**⚠️ OQ-D6-1 COLLAPSED — the original dual-key/backfill/transition-window design was DISPROVEN by verification (2026-06-14):** the only writer of `cashier_pin_records` is 019's provision handler, which ALWAYS sets a non-null `user_id` (born-neutral). No other INSERT exists; no clerk-only legacy rows can occur. So `0036` is a **direct rebuild** to a `user_id NOT NULL` PK with **no transition window, no dual-key, no backfill** — every extant row already satisfies the target PK. The spec §6 "a migrated row unlocks on `user_id` / a not-yet-migrated row unlocks on the bridge" model (and tasks T050/T051) describe a **population that cannot exist** and are superseded.

**What `0036` does** (`migrations/0036_reanchor_cashier_pin_records.sql`, TDD, 7/7): canonical SQLite table-rebuild — new table PK `(tenant,branch,terminal,user_id)`, `cashier_clerk_user_id` demoted to a **nullable, non-key bridge column** (G-3), `INSERT…SELECT` copy (explicit columns, no filter → P3 fail-loud on any null), DROP→RENAME, covering index re-keyed to `user_id`. No FK-dance needed (table has no FKs) → default runner transaction wrap.

**Runtime lookup — NO production code change (owner-decided 2026-06-14):** at offline unlock the renderer can only supply the cashier's **Clerk id** (`sign-in.tsx:131`; `user_id` is main-side-only per Constitution VII, no offline roster fetch). So the offline-unlock SELECT/UPDATE/`rowMatchesScope` **keep keying on the `cashier_clerk_user_id` bridge column** — which survives `0036` as a selectable non-PK column. G-1 (remove provider lock-in from the *schema identity*) is satisfied by the neutral PK; the runtime handle stays the bridge. Verified: `cashier-pin-records-reanchor-lookup.test.ts` (3/3) + the full operator/migration suite (239/239). `pin-credential.ts` untouched (T043; 019's guard test covers it).

**Remaining for Step 3:** (a) the **mandatory second-pair-of-eyes security review** (live sealed credential rows — P8); (b) optional row-type `user_id` carry on `CashierPinDbRow`/`PinRow` (visibility/audit, non-load-bearing); (c) reconcile spec §6 / tasks T042/T050/T051 prose to this corrected design; (d) the secret-free re-anchor audit event is a no-op here (the *migration* re-keys silently; there is no per-row runtime re-anchor event to emit, since no rows transition).

## Recommended sequence

> **✅ BOTH FORKS RESOLVED (owner, 2026-06-13):**
> - **Fork 2 → 004 follow-up.** Cashier-PIN provisioning is a deferred 004-operator-session capability, spec'd as its own feature — **[`specs/019-cashier-pin-provisioning`](../019-cashier-pin-provisioning/)** (tracking stub). 017 *depends on* it; it does not absorb it (P16).
> - **Fork 1 → hold.** Leave [`OUTBOX-DP2-cashier-user_id.md`](./OUTBOX-DP2-cashier-user_id.md) as the handoff; spec the ~4-line DP-2 roster `user_id` add **after** 019 is real, so the change and its POS consumer land coordinated.

**2 → 1 → 3**, not 1 → 2 → 3. Step 1 (DP-2) is trivial and not at risk, but it's the *lighter* half — shipping it first delivers a `user_id` POS has nowhere to write. With the forks resolved, the live order is:
1. ~~Owner resolves Fork 2~~ ✅ DONE → 004 follow-up = **019**.
2. ~~**Build POS provisioning (019)**~~ ✅ **DONE** — POS #398 merged. The create path + the **entire main-side consumption seam** shipped here: `interpretRosterResponse` (`backend-client.ts`) already populates the optional `user_id` from the wire when present; `provisionCashierPin` resolves `target_user_id` against the roster main-side and refuses `not_ready` if absent. **Built to light up automatically when DP-2 ships the field — no further POS wiring was needed to consume it.**
3. ~~**Spec + ship the DP-2 roster `user_id`** (Step 1)~~ ✅ **DONE** — DP-2 #571 (spec) + #573 (impl) merged; `user_id` is live on `PosRosterCashierEntry`. **⚠️ CORRECTION:** earlier framing said *"POS widens its roster allowlist as the matching half."* **That was wrong** — the renderer-facing `roster-handler.ts` allowlist (`{id,display_name,role}`) MUST stay strict (Constitution VII; the clerk↔neutral mapping stays main-side). 019 already kept `user_id` main-side; widening the renderer allowlist would *leak* it. No POS allowlist change was or is required. (Verified: `pin-management.provision.test.ts` covers both the populated-`user_id` success and pre-DP-2 `not_ready` paths — 71/71 green.)
4. **Execute 017** (Step 3) against the real per-cashier delivery — **the sole remaining feature work** (migration `0036` + code re-key on live sealed rows; needs the second-pair-of-eyes security review). Separately, a future **provisioning UI surface** is needed for a manager to actually invoke `provisionCashierPin` from the renderer (019 built the contract+handler+migration, not the UI) — but that is out of 017's scope.

## Dependency graph

```
Fork 2 (owner: provisioning owner = 017 or 004?)
   └─► Step 2 (POS provision-INSERT keyed on user_id)  ──┐
Fork 1 (owner: spec DP-2 now vs OUTBOX handoff)          │
   └─► Step 1 (DP-2 roster user_id, ~4 lines) ───────────┤
                                                          ▼
                                      Step 3 (017 re-anchor; migration 0036 = safety net; dual-key window)
                                                          │
                                                          ▼
                                      §A4 bridge re-check + §A5 readiness (T070)
```

## What stays true regardless of the forks

- PIN secret (`pin_hash`/`pin_salt`) never moves, never re-hashed (Invariant 1).
- `pin-credential.ts` (Argon2id verifier) is untouched — it never keyed on identity.
- No stranded cashier; no blind forced re-enrollment (Invariant 4 / A-4).
- 017 authors no DP-2 code (P16); the DP-2 ask is requested via the OUTBOX.

---

*This plan settles the investigation. The next action is an **owner decision on Fork 2** (which feature owns provisioning), after which Steps execute in the recommended 2→1→3 order. No implementation is dispatched until then.*

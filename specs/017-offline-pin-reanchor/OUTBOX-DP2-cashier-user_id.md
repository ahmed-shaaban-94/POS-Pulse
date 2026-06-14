# OUTBOX — to DP-2: surface the CASHIER's provider-neutral `user_id` on the roster/enrollment path

**From:** POS-Pulse · **Re:** POS-017 Offline-PIN Re-Anchor (drift D6) is data-blocked on a cashier-scoped `user_id`
**Date:** 2026-06-13 · **Status:** 🔴 OPEN — DP-2 input required before POS-017 can be implemented
**Mirrors:** the inbound [`INBOX-DP2-033.md`](./INBOX-DP2-033.md) flow, in the opposite direction.

> This is an outbound cross-repo request. POS authors **no** DP-2 code or contract (Constitution P16 — POS authors no upstream). It states the dependency precisely, sizes it, and asks DP-2 to spec the slice.

---

## The ask (one sentence)

**DP-2 must surface each cashier's provider-neutral §16 `user_id` (= `users.id`) on `PosRosterCashierEntry` — a ~4-line additive change, no provisioning (the value is already loaded at `findCashiersByStore:809`) — so POS-017 can key the local cashier-PIN store off the Clerk-coupled `cashier_clerk_user_id` and onto `user_id`. (POS keys its local enrollment off the roster-delivered `user_id`; no dedicated DP-2 PIN-enrollment contract is required.)**

## Why 033 did not unblock 017 (the precise gap)

033 (`c5e1c5d`, PR #567) added `user_id` to **`PosOperatorSummary`** — the **signing-in operator's** identity, delivered on the online `manager_admin` sign-in path. POS consumed it (PR #389, `backend-client.ts:44`). That satisfies operator self-identity.

But **POS-017 re-keys `cashier_pin_records`, which is keyed to the _cashier_ — a different principal** than the operator who signed in. The cashier's `user_id` is required, and it is delivered **nowhere**:

- **Contract proof (DP-2 `origin/main`, head `88c8d3d`):** `PosRosterCashierEntry` (`packages/contracts/openapi/pos-operators.openapi.yaml:510-537`) is the **only** POS-facing contract carrying cashier identity. It is `required: [id, display_name, role]`, `additionalProperties: false`, and `id` is documented as the **Clerk subject** (`users.clerk_user_id`). **No `user_id`.**
- PIN-only cashiers never traverse the online `manager_admin` path (POS spec evidence E-3), so there is no sign-in moment at which a cashier `user_id` could arrive by the 033 mechanism.

## Sizing — DP-2 part is ~4 lines; the heavier half is POS-internal

> **⚠️ REVISED 2026-06-13 after read-only investigation of DP-2 `origin/main` (`88c8d3d`). The original sizing below OVER-STATED the DP-2 cost — corrected here. The DP-2 ask is ~4 lines and needs NO `external_identity_links` provisioning. The larger remaining gap is POS-internal (cashier-PIN enrollment INSERT does not exist yet).**

### DP-2 ask — TRIVIAL (~4 lines, no provisioning) — VERIFIED

The cashier's `user_id` is **already in hand** at the roster build site; only the output shape omits it:

- **The roster query already joins on it.** `apps/api/src/pos-operators/pos-operators.service.ts:798-832` `findCashiersByStore` runs `JOIN users u ON u.id = m.user_id` (`:809`). The provider-neutral `user_id` **IS** `u.id` — the very join key. The query SELECTs `u.clerk_user_id, u.display_name` (`:806`) and maps to `{ id: row.clerk_user_id, display_name, role }` (`:827-831`). **No `external_identity_links` lookup is involved** — `users.id` is the users-table PK, always present.
- **033 confirms the principle explicitly.** `specs/033-pos-facing-user-id-surface/spec.md` Clarification Q4: *"`users.id` already exists and is already SELECTed … It does not depend on `external_identity_links` being backfilled — `userRow.id` is the users-table primary key, always present, independent of the 029 link table's deferred provisioning."* The provisioning concern applies to the **auth resolver** (mapping an inbound Clerk subject → `user_id`), NOT to the **roster** (which already has `users.id` from the membership join).
- **The change:** add `u.id` to the SELECT, `user_id: row.id` to the `:827` map, `user_id: string` to the `PosRosterCashierEntry` DTO (`dto.ts:138`), and `user_id` (`required`, `format: uuid`) to the OpenAPI schema `PosRosterCashierEntry` (`pos-operators.openapi.yaml:510`). Mirrors exactly what 033 did for `PosOperatorSummary` — but **033 scoped the roster OUT** (it touched `PosOperatorSummary` only; the cashier roster was missed).

**Why 033's "POS-017 UNBLOCKED" (SC-033-5) is mistaken:** 033 surfaced `user_id` for the *signing-in operator*. POS-017 re-keys `cashier_pin_records`, keyed to the *cashier* — a different principal. Both repos shared the same operator-vs-cashier blind spot. 033 unblocked operator-scoped local records; it did **not** unblock the cashier-PIN re-key.

### POS-side gap — LARGER than first assumed (the real remaining work)

1. **(RESOLVED) Cashier-PIN provisioning INSERT — built by POS-019 (merged, PR #398).** At the time this OUTBOX was written there was no `INSERT INTO cashier_pin_records` in POS `src/` (create path deferred from the 004 MVP). POS-019 has since built the born-neutral provisioning create path **keyed on `user_id` from creation**, plus the additive `user_id` column as migration `0035`. **Consequence:** 017's re-key migration (now numbered **`0036`** — `0035` is taken by 019's column) is a safety net for any **legacy** rows only; new rows are born neutral. The remaining cross-repo ask below (DP-2 roster `user_id`) is what lets 019's provisioning stop returning `not_ready`.
2. Widen the `roster-handler.ts:43` allowlist (currently destructures to `{ id, display_name, role }`) to thread `user_id` through to the enrollment write site.
3. Decide OQ-D6-1 against the real shape. **Constraint:** a NULL `user_id` cannot sit in a composite PRIMARY KEY (SQLite anti-pattern), so any pre-existing rows must retain `cashier_clerk_user_id` as the authoritative key until each has a real `user_id` — a dual-key/bridge window, not a single rebuild onto a half-empty `user_id` PK.

### Net blocker composition (shifted, NOT removed)

- **DP-2:** ~4-line roster change, no provisioning, no migration. Feasible today.
- **POS:** the heavier part — build cashier-PIN enrollment to key on `user_id` (004 dependency), then the bridge-window migration for any legacy rows.
- **Still blocks 017 implementation** until both land; the OUTBOX requests the DP-2 part (P16 — POS authors no DP-2 code).

## One question back to DP-2

**Will you surface the cashier's `user_id` on `PosRosterCashierEntry` (the ~4-line change above)?** It needs no `external_identity_links` provisioning — `users.id` is already loaded at `findCashiersByStore:809`. (A dedicated PIN-enrollment contract is NOT required on the DP-2 side; POS keys its local enrollment off the roster-delivered `user_id`.)

---

*Pointers (DP-2 side, VERIFIED): query+map `apps/api/src/pos-operators/pos-operators.service.ts:798-832`; DTO `apps/api/src/pos-operators/dto.ts:138`; OpenAPI `packages/contracts/openapi/pos-operators.openapi.yaml:510`. Precedent: 033 did the identical surfacing for `PosOperatorSummary`. POS side: `specs/017-offline-pin-reanchor/BLOCKER.md` rev. 3.*

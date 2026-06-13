# OUTBOX — to DP-2: surface the CASHIER's provider-neutral `user_id` on the roster/enrollment path

**From:** POS-Pulse · **Re:** POS-017 Offline-PIN Re-Anchor (drift D6) is data-blocked on a cashier-scoped `user_id`
**Date:** 2026-06-13 · **Status:** 🔴 OPEN — DP-2 input required before POS-017 can be implemented
**Mirrors:** the inbound [`INBOX-DP2-033.md`](./INBOX-DP2-033.md) flow, in the opposite direction.

> This is an outbound cross-repo request. POS authors **no** DP-2 code or contract (Constitution P16 — POS authors no upstream). It states the dependency precisely, sizes it, and asks DP-2 to spec the slice.

---

## The ask (one sentence)

**DP-2 must resolve and surface each cashier's provider-neutral §16 `user_id` (= `users.id`) on a POS-facing contract that carries cashier identity — i.e. `PosRosterCashierEntry` (and any future PIN-enrollment payload) — so POS-017 can re-key `cashier_pin_records`'s PRIMARY KEY off the Clerk-coupled `cashier_clerk_user_id` and onto `user_id`.**

## Why 033 did not unblock 017 (the precise gap)

033 (`c5e1c5d`, PR #567) added `user_id` to **`PosOperatorSummary`** — the **signing-in operator's** identity, delivered on the online `manager_admin` sign-in path. POS consumed it (PR #389, `backend-client.ts:44`). That satisfies operator self-identity.

But **POS-017 re-keys `cashier_pin_records`, which is keyed to the _cashier_ — a different principal** than the operator who signed in. The cashier's `user_id` is required, and it is delivered **nowhere**:

- **Contract proof (DP-2 `origin/main`, head `88c8d3d`):** `PosRosterCashierEntry` (`packages/contracts/openapi/pos-operators.openapi.yaml:510-537`) is the **only** POS-facing contract carrying cashier identity. It is `required: [id, display_name, role]`, `additionalProperties: false`, and `id` is documented as the **Clerk subject** (`users.clerk_user_id`). **No `user_id`.**
- PIN-only cashiers never traverse the online `manager_admin` path (POS spec evidence E-3), so there is no sign-in moment at which a cashier `user_id` could arrive by the 033 mechanism.

## Sizing — this is NOT just "add a field"

DP-2's identity resolution has shipped but provisioning has not:

- ✅ **Resolver is live:** `operator-context-resolver` resolves identity via the `external_identity_links` join (not `clerk_user_id`); unmapped subjects → `user_unmapped → refused`. So given an ACTIVE link row, DP-2 *can* map a cashier's Clerk subject → `user_id` today.
- ❌ **Link provisioning is NOT live:** `linkExternalIdentity` has **no runtime caller** — it appears only as a readiness stub (`apps/api/test/auth/identity-provider-readiness.unit.spec.ts:46`). Cashiers without an ACTIVE `external_identity_links` row cannot be resolved.

**Therefore the DP-2 slice is:** (1) ensure cashiers are provisioned in `external_identity_links` (the 029-deferred work, or a scoped subset for cashiers), and (2) add `user_id` (`required`, `format: uuid`) to `PosRosterCashierEntry` (and any PIN-enrollment payload), resolved server-side per cashier from the link. Until (1) lands, (2) would return rows where `user_id` cannot be resolved.

## POS-side follow-up once DP-2 ships (POS-owned, tracked in POS-017)

1. Widen the `roster-handler.ts:43` allowlist (currently destructures to `{ id, display_name, role }`) to thread `user_id` through.
2. Carry `user_id` from roster → PIN enrollment → the `cashier_pin_records` row, so the PK rebuild (migration `0035`, currently **not authored**) has a real `<user_id source>`.
3. Decide OQ-D6-1 (transition mechanism) against the real per-cashier delivery shape. **Constraint discovered this session:** a NULL `user_id` cannot sit in a composite PRIMARY KEY (SQLite anti-pattern), so the transition must retain `cashier_clerk_user_id` as the authoritative key until each row has a real `user_id` — i.e. a dual-key/bridge window, not a single rebuild onto a half-empty `user_id` PK.

## One question back to DP-2

**Will the cashier's `user_id` be surfaced on `PosRosterCashierEntry`, on a dedicated PIN-enrollment contract, or both — and is per-cashier `external_identity_links` provisioning in scope for that slice or a prerequisite to it?** The answer fixes POS-017's OQ-D6-1 transition design.

---

*Pointers (DP-2 side): contract `packages/contracts/openapi/pos-operators.openapi.yaml` → `PosRosterCashierEntry`; resolver `apps/api/src/.../operator-context-resolver`; link stub `linkExternalIdentity`. POS side: `specs/017-offline-pin-reanchor/BLOCKER.md` rev. 3 has the full evidence.*

# Phase 0 Research — Cashier-PIN Provisioning (019)

Resolves the NEEDS CLARIFICATION items from plan.md Technical Context.

## R-1 — Who owns the additive `user_id` column on `cashier_pin_records`?

**Decision:** **019 owns an additive, nullable `user_id TEXT` column migration** (next free number, `0035` if 019 lands first; renumber if 017 lands first). 019's provisioning writes a row with `user_id` populated and `cashier_clerk_user_id` left for the bridge. 017's re-anchor migration then only has to (a) backfill `user_id` for *legacy* rows and (b) re-key the PRIMARY KEY — it does not have to *introduce* the column.

**Rationale:** 019 is sequenced **before** 017 (UNBLOCK-PLAN 2→1→3 with 019 as Step 2). For 019 to write a born-neutral row, the `user_id` column must exist when 019 ships. If 019 waited for 017 to introduce the column, the sequence would invert. So the additive column is 019's; the PK *re-key* (the heavy, destructive table-rebuild) stays 017's. This cleanly splits the work along the P16 feature boundary: 019 = "new column + write path", 017 = "re-key existing PK + migrate legacy rows".

**Consequence for 017:** 017's migration `0035` (its number) becomes *backfill + PK-rebuild*, not *add-column + everything*. 017's BLOCKER/UNBLOCK-PLAN already frame `0035` as a legacy-row safety-net, consistent with this split. (017 docs should note the column may pre-exist from 019 — a coordination note, not a conflict.)

**Alternatives considered:**
- *(b) 017 owns the column, 019 depends on 017 landing first* — rejected: inverts the agreed 2→1→3 sequence; 019 couldn't be built/tested first.
- *(c) No column; 019 writes `user_id` into the existing `cashier_clerk_user_id` column* — rejected: re-introduces provider-coupling by overloading the clerk column; defeats born-neutral (SC-2) and 017's whole purpose.

**Column shape:** `user_id TEXT` (nullable during the bridge window — legacy rows have it NULL until 017 backfills; 019-created rows always populate it). NOT in the PK yet (017 re-keys the PK). A non-NULL `user_id` cannot sit in the composite PK until every row has one — exactly the 017 dual-key-window constraint. So 019 adds the column nullable + non-key; 017 promotes it into the PK.

## R-2 — Audit category wiring for `cashier.pin.provisioned`

**Decision:** add a new audit category `cashier.pin.provisioned` (sibling to the existing `cashier.pin.reset` / `cashier.pin.unlock`), with a payload `{ target_cashier_id (= user_id), terminal_id }` — scope + fact only, no secret. Mirrors the `CashierPinResetPayload` shape exactly.

**Rationale:** provisioning is a distinct, attributable manager/admin action (P10) and must be auditable separately from reset (a reset implies a pre-existing PIN; a provision implies first issuance). Reusing `cashier.pin.reset` would blur the audit trail. The existing audit category-extension migrations (e.g. `0017`/`0026`) are the precedent for adding a category.

**Alternatives:** reuse `cashier.pin.reset` — rejected (loses the first-issuance vs change distinction, weakens P4/P10).

## R-3 — Roster allowlist widening against the held DP-2 field

**Decision:** widen `roster-handler.ts`'s `{ id, display_name, role }` allowlist to `{ id, user_id, display_name, role }`, treating `user_id` as **optional on the wire** (present once DP-2 ships the field; absent until then). The provisioning handler keys off `user_id` and refuses "not ready" when it is absent (FR-11).

**Rationale:** the allowlist is defence-in-depth (FR-006/FR-031) — it must be explicitly widened or it would strip a `user_id` DP-2 adds. Treating it optional lets 019 ship and behave truthfully before the DP-2 slice lands (all cashiers "not ready"), then light up automatically when DP-2 surfaces the field. No POS code change needed at DP-2-ship time.

**Rationale for testability:** unit tests inject a fixture roster carrying `user_id`, exercising the full create path now; an integration "not ready" test injects a roster *without* `user_id` to assert the refuse path.

**Alternatives:** require `user_id` on the roster type now — rejected: would make the roster parse fail against today's DP-2 (which doesn't send it), breaking sign-in roster fetch before the held dependency lands.

---

*All NEEDS CLARIFICATION resolved. Proceed to Phase 1.*

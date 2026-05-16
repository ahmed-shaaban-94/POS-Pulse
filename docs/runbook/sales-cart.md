# Sales Cart — Runbook

> Support reference for cancellation and attribution troubleshooting.
> Spec: `specs/005-sales-cart`. Security contract: S0 contact sheet.

---

## Cart cancellation (void)

### Pre-handoff void (cashier or manager)

**Trigger:** Operator clicks "Void" in the cart header while the cart is in `editing` state.

**Normal flow:**
1. VoidConfirmation dialog opens with generic copy.
2. Operator confirms → `cart.void` IPC call → bridge transitions cart to `cancelled`.
3. CartPane updates local state; active cart is cleared.

**Refused — `frozen` reason:**
- Cart is in `frozen_handed_off` state and the calling session is a cashier.
- Resolution: A manager must perform the post-handoff cancel (`cart.cancelPostHandoff`, T068).
- Do NOT expose manager identity to the cashier UI.

**Refused — `closed` reason:**
- Cart is already `cancelled` or in a terminal state.
- Resolution: Cart is already closed. No action needed.

---

### Post-handoff cancel (manager only)

**Trigger:** Cart has been handed off to the payment terminal and must be recalled.

**Requirement:** Manager-level session or `attribution_operator_id` from a manager.

**Normal flow:**
1. Manager invokes `cart.cancelPostHandoff` with `handoff_action_id` and `attribution_operator_id`.
2. Bridge verifies state is `frozen_handed_off` and attribution is from a manager.
3. Cart transitions to `cancelled`; audit event `cart.cancel.post_handoff` emitted.

**Refused — `manager_attribution_required`:**
- Caller is a cashier session with no `attribution_operator_id`.
- Resolution: Cashier must request manager attribution via ManagerAttributionPrompt before retrying.

**Refused — `closed`:**
- Cart is not in `frozen_handed_off` state.
- Resolution: Check current cart state; cancel may already be in progress or complete.

---

## Discount placeholder attribution

### Adding a discount placeholder

**Trigger:** Cashier attempts to add a discount above the threshold.

**Normal flow (no attribution required):**
1. `cart.discountPlaceholders.add` returns `{ kind: 'ok', requires_manager_attribution: false }`.
2. DiscountPlaceholderRow is rendered with "Discount applied" label (no magnitude).

**Requires manager attribution:**
1. Bridge returns `{ kind: 'ok', requires_manager_attribution: true }`.
2. CartStore transitions to `discount_pending_attribution`.
3. ManagerAttributionPrompt opens — cashier enters Manager ID (no manager name displayed).
4. Retry `discountPlaceholders.add` with `attribution_operator_id`.

**Refused — `manager_attribution_required`:**
- Attribution was missing or provided by the same-role operator.
- Resolution: Re-open ManagerAttributionPrompt with a valid manager ID.

### Removing a discount placeholder

**Normal flow:** `discountPlaceholders.remove` succeeds, row is removed from CartPane.

**Refused — `manager_attribution_required`:**
- The placeholder was originally added with manager attribution; removal also requires it.
- Resolution: ManagerAttributionPrompt → retry with `attribution_operator_id`.

---

## Session-end cart discard

**Trigger:** Operator session ends (sign-out, inactivity timeout, or session takeover).

**Policy (Q3a — LOCKED 2026-05-14):**
- Draft carts (`empty` or `editing`) are discarded automatically → state `cancelled`.
- `frozen_handed_off` carts are NOT discarded on session end (payment flow in progress).

**Audit:** `cart.discarded_on_session_end` event emitted with `discard_cause`.

**Discard causes:**
- `signed_out` — operator signed out normally.
- `inactivity_timeout` — session expired due to inactivity.
- `superseded_by_takeover` — another operator took over the terminal.

---

## Security reminders

- Never display shift totals, expected drawer cash, overages, or shortages on any cart surface.
- Manager identity must not be shown to cashier at any point (FR-033 generic copy mandate).
- Discount magnitudes must not appear in the cart UI (no numeric values on DiscountPlaceholderRow).
- No cart IDs, session IDs, or UUIDs should appear in user-facing copy.

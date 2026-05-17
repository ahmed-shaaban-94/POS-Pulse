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

## Cart handoff to payment (T086)

### Normal handoff flow

**Trigger:** Cashier clicks "Hand off to payment terminal" while cart is in `editing` state.

**Preconditions:**
- Active operator session (cashier, manager, or admin).
- At least one non-removed line in the cart.
- All `per_line_versions` match current line versions (staleness guard).

**Normal flow:**
1. `cart.handoff` IPC call received by bridge.
2. Session gate + ownership check passes.
3. Per-line version staleness check passes.
4. `buildPaymentIntentEnvelope` computes `subtotal_minor` from active lines and freezes the envelope.
5. Atomic SQLite transaction: outbox row (`cart.handoff_to_payment`), `carts` row updated to `frozen_handed_off` + `handoff_envelope_json`, audit event emitted.
6. Frozen `PaymentIntentEnvelope v1` returned to renderer.
7. Renderer displays handoff confirmation — does NOT claim payment succeeded.

---

### Handoff failure paths

**Refused — `no_session`:**
- No active operator session.
- Resolution: Operator must sign in before initiating handoff.

**Refused — `wrong_owner`:**
- Cart does not exist or belongs to a different session/tenant.
- Resolution: Verify `cart_id` is correct for the current session.

**Refused — `empty_cart`:**
- Cart has no non-removed lines at handoff time.
- Cause: All lines were removed before handoff, or cart was never populated.
- Resolution: Add at least one item before handing off.

**Refused — `stale_version`:**
- A `per_line_versions` entry does not match the current line version in the DB.
- Cause: A concurrent modification (add/update/remove) occurred between the UI snapshot and the handoff call.
- Resolution: Renderer must refetch cart state and retry with fresh versions.

**Refused — `frozen`:**
- Cart is in `frozen_handed_off` or `handing_off` state.
- Cause: Handoff already in progress or complete; or defence-in-depth `handing_off` guard fired.
- Resolution: Do not retry handoff. If payment must be cancelled, use `cart.cancelPostHandoff`.

**Refused — `closed`:**
- Cart is `cancelled`.
- Resolution: Cart is already closed; no handoff possible.

**Refused — `idempotency_payload_mismatch`:**
- The `idempotency_key` was previously used for a different action kind.
- Cause: Key reuse across unrelated operations.
- Resolution: Generate a fresh UUID v4 for each distinct handoff attempt.

---

### Idempotency replay

If the same `idempotency_key` is submitted after a successful handoff, the bridge returns the
original frozen `PaymentIntentEnvelope v1` read from `carts.handoff_envelope_json` — no second
write occurs. This ensures at-most-once semantics even if the renderer retries after a crash.

---

### Envelope security invariants

- The envelope contains **no** session credentials, PINs, PIN hashes, passwords, device tokens,
  or raw sensitive payloads.
- The envelope must **not** include `payment_status`, `paid_at`, `tender_amount`,
  `change_amount`, or `payment_confirmed` — these belong to the future payments feature.
- `subtotal_minor` is recomputed fresh from active lines; it is **not** read from the
  `carts.cart_subtotal_minor` running total (avoids race conditions).
- `Number.isSafeInteger` is asserted on `subtotal_minor` before the envelope is constructed.
- The returned envelope is `Object.freeze`d recursively (envelope, lines array, each line,
  discount_placeholders array, each placeholder).

---

## Security reminders

- Never display shift totals, expected drawer cash, overages, or shortages on any cart surface.
- Manager identity must not be shown to cashier at any point (FR-033 generic copy mandate).
- Discount magnitudes must not appear in the cart UI (no numeric values on DiscountPlaceholderRow).
- No cart IDs, session IDs, or UUIDs should appear in user-facing copy.

# Cart Workflow — Operator Onboarding

> Audience: cashier operating a terminal. This guide walks you through one sale from
> start to handoff. Keep it open the first few times; you will not need it for long.

---

## 1. Build the cart

1. **Sign in** to the terminal with your operator credentials.
2. **Add items** by scanning the barcode or searching by name. Each confirmed item
   appears as one line in the cart pane on the right.
   - If you scan the same item twice, the existing line's quantity goes up by one — you
     do not get two separate lines for the same product.
   - A line only appears after the system confirms it. If the terminal is busy you
     may see a brief pause; wait for the line before scanning the next item.
3. **Adjust quantities** with the plus and minus buttons on each line. Decreasing the
   quantity to zero removes the line.
4. **Add an optional note** to a line (for example "fragile" or a customer
   instruction). Notes are limited to 200 characters and may not contain personal
   information, card numbers, or credentials — the terminal will refuse such notes
   with a generic message.
5. **Review the list** before moving on. The cart pane shows item names, quantities,
   and per-line subtotals.

---

## 2. Apply a discount

1. Open the discount control on the line (or on the cart, depending on the discount
   type your branch uses).
2. The discount appears on the cart as a placeholder pill labelled "Discount
   applied". The pill confirms the discount is attached; the exact amount is set
   later, downstream of the cart.
3. **Above-threshold discounts need manager approval.** If the discount you are
   trying to apply is large enough to require approval, the terminal will prompt for
   a manager — follow the on-screen instructions. The cashier surface never displays
   who the approving manager is; the system records the approval internally.
4. To remove a placeholder, use the remove control on the pill. If the placeholder
   was added with manager approval, removing it will also prompt for manager
   approval.

---

## 3. Hand off to payment

1. Once the cart has at least one line, the **"Hand off to payment"** button becomes
   available in the cart header.
2. Press it once. The terminal will show a confirmation banner: **"Cart sent to
   payment."**
3. After this point the cart is **frozen** — see step 5 below.

You can void the cart at any time before handoff using the **"Void"** button in the
cart header. A simple confirmation dialog appears; confirm to clear the cart.

---

## 4. Pay (downstream feature)

Payment itself happens in the payments surface, which is a separate feature from the
cart. After handoff, the payments surface picks up where the cart left off:

- The cart is finalised — its lines, quantities, and notes cannot change.
- The cashier completes the payment (cash, card, etc.) in the payments surface
  according to its own onboarding guide.
- Until the payments feature is enabled on your terminal, only the handoff step
  above is available from the cart pane; ask your branch lead about the payments
  rollout status.

The cart workflow does not handle money, change, drawers, or receipts — those belong
to the payments surface.

---

## 5. The frozen state, safely

After a successful handoff the cart enters a **frozen** state. What you will see and
what to expect:

- A read-only summary of the cart appears in place of the editing controls. Lines,
  quantities, notes, and any discount placeholders are visible but cannot be
  changed.
- The "Void" button is not available to you while the cart is frozen — only a
  manager can void a cart that has already been handed off.
- The "Hand off to payment" button is not available either — handoff happens once
  per cart.
- If you started the next sale by accident, simply start a new cart from the cart
  pane; the frozen cart stays as it is and the new cart is independent.
- If something is wrong with a frozen cart (item entered incorrectly, customer
  changed their mind after handoff), ask a manager. They have a separate, audited
  control to void a frozen cart. After a manager voids it, you start a new cart for
  the corrected sale; the original frozen cart cannot be re-opened.

---

## Quick reference

| You want to                                          | Do this                                                |
|:-----------------------------------------------------|:-------------------------------------------------------|
| Add an item                                          | Scan or search; wait for the line to appear            |
| Increase quantity                                    | Press the plus button on the line                      |
| Remove a line                                        | Press the minus button until quantity reaches zero     |
| Add a note to a line                                 | Open the note control; keep it under 200 characters    |
| Apply a small discount                               | Use the discount control; placeholder pill appears     |
| Apply a large discount                               | Same control; follow the manager-approval prompt       |
| Cancel the cart before handoff                       | Press "Void" in the cart header; confirm in the dialog |
| Send the cart forward for payment                    | Press "Hand off to payment"                            |
| Edit a cart after handoff                            | You cannot — start a new cart, or ask a manager        |
| Void a cart after handoff                            | Ask a manager                                          |

If anything on the screen does not match this guide, ask a manager or your branch
lead before retrying — the terminal records each step, so a fresh start is always
safer than forcing a control that is greyed out.

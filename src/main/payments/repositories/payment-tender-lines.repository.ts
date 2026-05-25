/**
 * T112 — `payment_tender_lines` repository.
 *
 * Owns SQL access for the `payment_tender_lines` table (006-payments-tender
 * Slice 3a). Wraps the production `DatabaseHandle` so tests can inject a
 * sql.js adapter.
 *
 * Surface per tasks.md T112: insert, updateState, findByAttempt, and the
 * canonical settlement-sum query from data-model.md §"Invariant 5":
 *
 *   Σ (amount_applied_minor − COALESCE(change_due_minor, 0))
 *   WHERE state = 'applied'
 *
 * The `change_due_minor` subtraction handles cash overpayment correctly:
 * cash lines MAY overpay and the overage is returned to the customer; only
 * the net contribution counts toward the envelope subtotal. Non-cash lines
 * have `change_due_minor = NULL` (CHECK constraint in migration 0014), so
 * COALESCE makes them contribute `amount_applied_minor` directly.
 *
 * No FSM rules are enforced here — illegal transitions are S3b's domain.
 * The repository only commits the row state the caller specifies.
 */

import type { DatabaseHandle } from '../../db/client.js';

interface PrepareRun {
  run(...params: unknown[]): { changes: number; lastInsertRowid: number | bigint };
}

interface PrepareGet<Row> {
  get(...params: unknown[]): Row | undefined;
}

interface PrepareAll<Row> {
  all(...params: unknown[]): Row[];
}

export type TenderType = 'cash' | 'external_card_terminal' | 'internal_voucher';

export type TenderLineState = 'applying' | 'applied' | 'refused' | 'reversed' | 'reversal_pending';

export interface PaymentTenderLineRow {
  tender_line_id: string;
  payment_attempt_id: string;
  tender_type: TenderType;
  amount_applied_minor: number;
  state: TenderLineState;
  change_due_minor: number | null;
  external_reference: string | null;
  voucher_redemption_intent_token: string | null;
  voucher_authority_redemption_id: string | null;
  applied_at: string | null;
  refused_at: string | null;
  reversed_at: string | null;
  reversal_pending_since: string | null;
  refusal_reason: string | null;
  attribution_operator_id: string;
  apply_order: number;
  last_action_id: string;
}

export interface InsertPaymentTenderLineInput {
  tender_line_id: string;
  payment_attempt_id: string;
  tender_type: TenderType;
  amount_applied_minor: number;
  state: TenderLineState;
  change_due_minor: number | null;
  external_reference: string | null;
  voucher_redemption_intent_token: string | null;
  voucher_authority_redemption_id: string | null;
  applied_at: string | null;
  refused_at: string | null;
  reversed_at: string | null;
  reversal_pending_since: string | null;
  refusal_reason: string | null;
  attribution_operator_id: string;
  apply_order: number;
  last_action_id: string;
}

/**
 * Discriminated union per state — type system enforces required auxiliary
 * fields per transition (CLAUDE.md "trust internal code, validate at boundaries").
 */
export type UpdateTenderLineStateInput =
  | {
      tender_line_id: string;
      state: 'applied' | 'reversed' | 'reversal_pending';
      timestamp: string;
      last_action_id: string;
    }
  | {
      tender_line_id: string;
      state: 'refused';
      timestamp: string;
      last_action_id: string;
      refusal_reason: string;
    };

export interface PaymentTenderLinesRepository {
  insert(input: InsertPaymentTenderLineInput): void;
  /**
   * Transitions a tender line to a terminal state.
   *
   * **Caller contract:** the TenderLine FSM (S3b) is responsible for
   * verifying that the target line exists and that the transition is legal
   * before calling this method. This method does NOT throw on
   * `tender_line_id` not-found — the UPDATE silently affects zero rows.
   * The S3b FSM calls `findByAttempt` first as part of its transition
   * matrix, which is also where legal-vs-illegal transition enforcement
   * happens. Trust-internal-code boundary per CLAUDE.md.
   */
  updateState(input: UpdateTenderLineStateInput): void;
  findByAttempt(payment_attempt_id: string): PaymentTenderLineRow[];
  /**
   * S3c addition (F-005) — single-row lookup by primary key.
   *
   * `tender.read` and `tender.reverse` bridge handlers carry only the
   * `tender_line_id` in their request shape (contracts/bridge-api.md
   * §"tender.read" + §"tender.reverse"). Resolving the bound attempt
   * for the gating projection requires a `tender_line_id → row` query
   * the original S3a surface didn't expose. The PK index added by
   * migration 0014 makes this an O(log n) equality lookup.
   *
   * Returns `undefined` when the id is unknown — callers map that to the
   * closed `line_not_applied` refusal reason.
   */
  findByLineId(tender_line_id: string): PaymentTenderLineRow | undefined;
  /**
   * Canonical settlement-invariant sum per data-model §"Invariant 5".
   * Returns 0 when the attempt has no applied lines yet. Throws
   * `TypeError` if the SUM exceeds `Number.MAX_SAFE_INTEGER` — a money
   * defence-in-depth check at the aggregate boundary.
   */
  settlementSumMinor(payment_attempt_id: string): number;
  /**
   * Wave 4 voucher-redeem persistence. Stamps the V-A
   * `redemption_id` returned by `posRedeemVoucher` onto the existing
   * `payment_tender_lines` row inside the caller's outer transaction.
   * The line MUST already be in `applied` state — the FSM owns state
   * transitions; this setter only fills in the durable correlation id.
   *
   * Returns silently when the row is absent (caller checks state via
   * `findByLineId`/`findByAttempt` first). `last_action_id` is updated
   * to the redeem action_id so the outbox row hash chain stays
   * consistent.
   */
  persistAuthorityRedemptionId(input: {
    tender_line_id: string;
    voucher_authority_redemption_id: string;
    last_action_id: string;
  }): void;
}

export function bindPaymentTenderLinesRepository(db: DatabaseHandle): PaymentTenderLinesRepository {
  const insertStmt = db.prepare(
    `INSERT INTO payment_tender_lines (
       tender_line_id, payment_attempt_id, tender_type, amount_applied_minor, state,
       change_due_minor, external_reference,
       voucher_redemption_intent_token, voucher_authority_redemption_id,
       applied_at, refused_at, reversed_at, reversal_pending_since,
       refusal_reason, attribution_operator_id, apply_order, last_action_id
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ) as PrepareRun;

  const updateToApplied = db.prepare(
    `UPDATE payment_tender_lines
        SET state='applied', applied_at=?, last_action_id=?
      WHERE tender_line_id=?`,
  ) as PrepareRun;

  const updateToRefused = db.prepare(
    `UPDATE payment_tender_lines
        SET state='refused', refused_at=?, refusal_reason=?, last_action_id=?
      WHERE tender_line_id=?`,
  ) as PrepareRun;

  const updateToReversed = db.prepare(
    `UPDATE payment_tender_lines
        SET state='reversed', reversed_at=?, reversal_pending_since=NULL, last_action_id=?
      WHERE tender_line_id=?`,
  ) as PrepareRun;

  const updateToReversalPending = db.prepare(
    `UPDATE payment_tender_lines
        SET state='reversal_pending', reversal_pending_since=?, last_action_id=?
      WHERE tender_line_id=?`,
  ) as PrepareRun;

  const findByAttemptStmt = db.prepare(
    `SELECT * FROM payment_tender_lines
       WHERE payment_attempt_id=?
       ORDER BY apply_order ASC`,
  ) as PrepareAll<PaymentTenderLineRow>;

  const findByLineIdStmt = db.prepare(
    `SELECT * FROM payment_tender_lines WHERE tender_line_id=?`,
  ) as PrepareGet<PaymentTenderLineRow>;

  const persistRedemptionIdStmt = db.prepare(
    `UPDATE payment_tender_lines
        SET voucher_authority_redemption_id=?, last_action_id=?
      WHERE tender_line_id=?`,
  ) as PrepareRun;

  const settlementSumStmt = db.prepare(
    `SELECT COALESCE(
              SUM(amount_applied_minor - COALESCE(change_due_minor, 0)),
              0
            ) AS settlement_sum_minor
       FROM payment_tender_lines
      WHERE payment_attempt_id=? AND state='applied'`,
  ) as PrepareGet<{ settlement_sum_minor: number }>;

  return {
    insert(input: InsertPaymentTenderLineInput): void {
      insertStmt.run(
        input.tender_line_id,
        input.payment_attempt_id,
        input.tender_type,
        input.amount_applied_minor,
        input.state,
        input.change_due_minor,
        input.external_reference,
        input.voucher_redemption_intent_token,
        input.voucher_authority_redemption_id,
        input.applied_at,
        input.refused_at,
        input.reversed_at,
        input.reversal_pending_since,
        input.refusal_reason,
        input.attribution_operator_id,
        input.apply_order,
        input.last_action_id,
      );
    },

    updateState(input: UpdateTenderLineStateInput): void {
      switch (input.state) {
        case 'applied':
          updateToApplied.run(input.timestamp, input.last_action_id, input.tender_line_id);
          return;
        case 'refused':
          updateToRefused.run(
            input.timestamp,
            input.refusal_reason,
            input.last_action_id,
            input.tender_line_id,
          );
          return;
        case 'reversed':
          updateToReversed.run(input.timestamp, input.last_action_id, input.tender_line_id);
          return;
        case 'reversal_pending':
          updateToReversalPending.run(input.timestamp, input.last_action_id, input.tender_line_id);
          return;
      }
    },

    findByAttempt(payment_attempt_id: string): PaymentTenderLineRow[] {
      return findByAttemptStmt.all(payment_attempt_id);
    },

    findByLineId(tender_line_id: string): PaymentTenderLineRow | undefined {
      return findByLineIdStmt.get(tender_line_id) ?? undefined;
    },

    persistAuthorityRedemptionId(input: {
      tender_line_id: string;
      voucher_authority_redemption_id: string;
      last_action_id: string;
    }): void {
      persistRedemptionIdStmt.run(
        input.voucher_authority_redemption_id,
        input.last_action_id,
        input.tender_line_id,
      );
    },

    settlementSumMinor(payment_attempt_id: string): number {
      const row = settlementSumStmt.get(payment_attempt_id);
      const total = row?.settlement_sum_minor ?? 0;
      // Constitution §II — money is integer minor units. The per-line CHECKs
      // make exceeding MAX_SAFE_INTEGER practically impossible, but a SUM is
      // the one boundary where defence-in-depth is warranted: a corrupted
      // migration or a future column-shape change could violate the invariant
      // silently. Throw here so S3b's settlement comparison cannot proceed
      // against an unsafe sum.
      if (!Number.isSafeInteger(total)) {
        throw new TypeError(
          `payment_tender_lines settlement_sum_minor is not a safe integer for attempt ${payment_attempt_id}: ${String(total)}`,
        );
      }
      return total;
    },
  };
}

/* eslint-disable @typescript-eslint/unbound-method --
 * See bridge.payments-start.test.ts for rationale.
 */
/**
 * T103 — `payments.subscribe` + `payments.read` bridge handler test (RED).
 *
 * Both handlers return the same renderer-minimised projection (FR-017,
 * contracts/bridge-api.md §"payments.subscribe" + §"payments.read"). In
 * Slice 3 the typed seam is a one-shot Promise<...Response> for both —
 * any future push-stream mechanism would land on a separate channel.
 *
 * Asserts:
 *   1. Session gate (no_session / role_denied / wrong_owner / tenant_isolation).
 *      attempt_terminal is NOT a refusal for READ — a settled / cancelled /
 *      failed attempt is still readable for receipt-handoff (AD-9).
 *      Handlers MUST pass `attempt: undefined` so the gating helper skips
 *      the terminal-state check; ownership + isolation are enforced manually
 *      against the persisted row.
 *   2. Idempotency: read paths do NOT require an idempotency_key (they
 *      are not mutating). No outbox interaction at all.
 *   3. Projection — `payment_attempt` renderer view contains:
 *        payment_attempt_id, state, envelope_subtotal_minor, started_at,
 *        settled_at? cancelled_at? failed_at? force_failed_at?,
 *        tender_lines: TenderLineRendererView[]
 *      Each `tender_lines` entry contains:
 *        tender_line_id, tender_type, amount_applied_minor, change_due_minor?,
 *        external_reference?, voucher_authority_redemption_id?, state,
 *        applied_at?, refused_at?, reversed_at?, reversal_pending_since?,
 *        refusal_reason?, apply_order
 *      And **never** contains:
 *        voucher_redemption_intent_token, voucher_code,
 *        attribution_operator_id, last_action_id (server-side audit fields).
 *   4. Both handlers produce byte-identical projections for the same
 *      attempt id (subscribe is functionally `read` at the Slice-3 seam).
 *
 * **Wave G — TDD RED.** Forward-references the Wave H modules.
 */

import { describe, expect, it } from 'vitest';

import { createPaymentsSubscribeHandler } from '../../../../src/main/payments/handlers/payments-subscribe.js';
import { createPaymentsReadHandler } from '../../../../src/main/payments/handlers/payments-read.js';
import { createTenderReadHandler } from '../../../../src/main/payments/handlers/tender-read.js';

import {
  makeAttemptRow,
  makeAttemptsRepoDouble,
  makeLineRow,
  makeLinesRepoDouble,
  makeSession,
  makeSessionSource,
} from './__fixtures__/bridge-handler-deps.js';
import type {
  PaymentsReadRequest,
  PaymentsSubscribeRequest,
  TenderReadRequest,
} from '../../../../src/shared/bridge-api.js';

function setup() {
  const sessionSource = makeSessionSource(makeSession());
  const row = makeAttemptRow({ envelope_subtotal_minor: 3500 });
  const attemptsRepo = makeAttemptsRepoDouble([row]);
  const linesRepo = makeLinesRepoDouble([
    makeLineRow({
      tender_line_id: 'tl-1',
      tender_type: 'cash',
      amount_applied_minor: 2000,
      change_due_minor: 500,
      applied_at: '2026-05-23T11:00:01.000Z',
      apply_order: 1,
    }),
    makeLineRow({
      tender_line_id: 'tl-2',
      tender_type: 'external_card_terminal',
      amount_applied_minor: 2000,
      external_reference: 'AB12XY',
      applied_at: '2026-05-23T11:00:02.000Z',
      apply_order: 2,
    }),
  ]);
  const readHandler = createPaymentsReadHandler({
    getCurrentSession: sessionSource.getCurrentSession,
    attemptsRepo,
    linesRepo,
  });
  const subscribeHandler = createPaymentsSubscribeHandler({
    getCurrentSession: sessionSource.getCurrentSession,
    attemptsRepo,
    linesRepo,
  });
  return { sessionSource, attemptsRepo, linesRepo, readHandler, subscribeHandler };
}

const validReadReq: PaymentsReadRequest = { payment_attempt_id: 'pa-1' };
const validSubReq: PaymentsSubscribeRequest = { payment_attempt_id: 'pa-1' };

describe('T103 — payments.read + payments.subscribe', () => {
  it('payments.read refuses no_session when there is no active session', async () => {
    const readHandler = createPaymentsReadHandler({
      getCurrentSession: makeSessionSource(null).getCurrentSession,
      attemptsRepo: makeAttemptsRepoDouble(),
      linesRepo: makeLinesRepoDouble(),
    });
    expect(await readHandler(validReadReq)).toEqual({
      kind: 'refused',
      reason: 'no_session',
    });
  });

  it('payments.subscribe refuses no_session when there is no active session', async () => {
    const subscribeHandler = createPaymentsSubscribeHandler({
      getCurrentSession: makeSessionSource(null).getCurrentSession,
      attemptsRepo: makeAttemptsRepoDouble(),
      linesRepo: makeLinesRepoDouble(),
    });
    expect(await subscribeHandler(validSubReq)).toEqual({
      kind: 'refused',
      reason: 'no_session',
    });
  });

  it('refuses wrong_owner when the attempt belongs to another session', async () => {
    const sessionSource = makeSessionSource(makeSession());
    const row = makeAttemptRow({ operator_session_id: 'sess-OTHER' });
    const readHandler = createPaymentsReadHandler({
      getCurrentSession: sessionSource.getCurrentSession,
      attemptsRepo: makeAttemptsRepoDouble([row]),
      linesRepo: makeLinesRepoDouble(),
    });
    expect(await readHandler(validReadReq)).toEqual({
      kind: 'refused',
      reason: 'wrong_owner',
    });
  });

  it('refuses tenant_isolation on cross-tenant access', async () => {
    const sessionSource = makeSessionSource(makeSession());
    const row = makeAttemptRow({ tenant_id: 'tenant-OTHER' });
    const readHandler = createPaymentsReadHandler({
      getCurrentSession: sessionSource.getCurrentSession,
      attemptsRepo: makeAttemptsRepoDouble([row]),
      linesRepo: makeLinesRepoDouble(),
    });
    expect(await readHandler(validReadReq)).toEqual({
      kind: 'refused',
      reason: 'tenant_isolation',
    });
  });

  it('refuses attempt_terminal when the attempt_id is unknown', async () => {
    const sessionSource = makeSessionSource(makeSession());
    const readHandler = createPaymentsReadHandler({
      getCurrentSession: sessionSource.getCurrentSession,
      attemptsRepo: makeAttemptsRepoDouble([]),
      linesRepo: makeLinesRepoDouble(),
    });
    expect(await readHandler(validReadReq)).toEqual({
      kind: 'refused',
      reason: 'attempt_terminal',
    });
  });

  it('payments.read returns the projection for an active started attempt', async () => {
    const { readHandler } = setup();
    const result = await readHandler(validReadReq);
    expect(result.kind).toBe('ok');
    if (result.kind !== 'ok') return;
    expect(result.payment_attempt).toMatchObject({
      payment_attempt_id: 'pa-1',
      state: 'started',
      envelope_subtotal_minor: 3500,
      started_at: '2026-05-23T11:00:00.000Z',
    });
    expect(result.payment_attempt.tender_lines).toHaveLength(2);
    // Lines sorted by apply_order ASC (canonical render order).
    expect(result.payment_attempt.tender_lines[0]).toMatchObject({
      tender_line_id: 'tl-1',
      tender_type: 'cash',
      amount_applied_minor: 2000,
      change_due_minor: 500,
      state: 'applied',
      apply_order: 1,
    });
    expect(result.payment_attempt.tender_lines[1]).toMatchObject({
      tender_line_id: 'tl-2',
      tender_type: 'external_card_terminal',
      amount_applied_minor: 2000,
      external_reference: 'AB12XY',
      state: 'applied',
      apply_order: 2,
    });
  });

  it('payments.read on a terminal-state attempt (settled) still returns the projection', async () => {
    const sessionSource = makeSessionSource(makeSession());
    const settledRow = makeAttemptRow({
      state: 'settled',
      settled_at: '2026-05-23T11:00:05.000Z',
    });
    const handler = createPaymentsReadHandler({
      getCurrentSession: sessionSource.getCurrentSession,
      attemptsRepo: makeAttemptsRepoDouble([settledRow]),
      linesRepo: makeLinesRepoDouble(),
    });
    const result = await handler(validReadReq);
    expect(result.kind).toBe('ok');
    if (result.kind !== 'ok') return;
    expect(result.payment_attempt.state).toBe('settled');
    expect(result.payment_attempt.settled_at).toBe('2026-05-23T11:00:05.000Z');
  });

  it('projection does NOT contain voucher tokens, voucher_code, attribution_operator_id, or last_action_id', async () => {
    const sessionSource = makeSessionSource(makeSession());
    const row = makeAttemptRow();
    const linesRepo = makeLinesRepoDouble([
      makeLineRow({
        tender_line_id: 'tl-1',
        tender_type: 'cash',
        amount_applied_minor: 1500,
        applied_at: '2026-05-23T11:00:01.000Z',
        attribution_operator_id: 'op-clerk-user-abc',
        last_action_id: 'apply-tl-1',
      }),
    ]);
    const handler = createPaymentsReadHandler({
      getCurrentSession: sessionSource.getCurrentSession,
      attemptsRepo: makeAttemptsRepoDouble([row]),
      linesRepo,
    });
    const result = await handler(validReadReq);
    expect(result.kind).toBe('ok');
    if (result.kind !== 'ok') return;
    const serialised = JSON.stringify(result);
    expect(serialised).not.toContain('voucher_redemption_intent_token');
    expect(serialised).not.toContain('voucher_code');
    // The operator id is server-side only; it must not appear on the
    // line-view shape that crosses to the renderer.
    expect(serialised).not.toContain('attribution_operator_id');
    expect(serialised).not.toContain('last_action_id');
  });

  it('payments.subscribe returns the same projection as payments.read for the same attempt', async () => {
    const { readHandler, subscribeHandler } = setup();
    const read = await readHandler(validReadReq);
    const sub = await subscribeHandler(validSubReq);
    // Both kinds must be `ok` for the comparison to mean anything.
    expect(read.kind).toBe('ok');
    expect(sub.kind).toBe('ok');
    if (read.kind !== 'ok' || sub.kind !== 'ok') return;
    expect(sub.payment_attempt).toEqual(read.payment_attempt);
  });

  it('payments.subscribe applies the same refusal envelope as payments.read', async () => {
    const sessionSource = makeSessionSource(makeSession());
    const row = makeAttemptRow({ tenant_id: 'tenant-OTHER' });
    const subscribeHandler = createPaymentsSubscribeHandler({
      getCurrentSession: sessionSource.getCurrentSession,
      attemptsRepo: makeAttemptsRepoDouble([row]),
      linesRepo: makeLinesRepoDouble(),
    });
    expect(await subscribeHandler(validSubReq)).toEqual({
      kind: 'refused',
      reason: 'tenant_isolation',
    });
  });
});

// ── tender.read (T141) — single-line projection, same minimisation rules ─────

describe('T141 — tender.read bridge handler', () => {
  const validTenderReq: TenderReadRequest = { tender_line_id: 'tl-1' };

  function setupRead() {
    const sessionSource = makeSessionSource(makeSession());
    const row = makeAttemptRow();
    const linesRepo = makeLinesRepoDouble([
      makeLineRow({
        tender_line_id: 'tl-1',
        tender_type: 'external_card_terminal',
        amount_applied_minor: 2000,
        external_reference: 'AB12XY',
        applied_at: '2026-05-23T11:00:02.000Z',
        apply_order: 1,
      }),
    ]);
    const handler = createTenderReadHandler({
      getCurrentSession: sessionSource.getCurrentSession,
      attemptsRepo: makeAttemptsRepoDouble([row]),
      linesRepo,
    });
    return { handler, sessionSource };
  }

  it('refuses no_session when there is no active session', async () => {
    const handler = createTenderReadHandler({
      getCurrentSession: makeSessionSource(null).getCurrentSession,
      attemptsRepo: makeAttemptsRepoDouble(),
      linesRepo: makeLinesRepoDouble(),
    });
    expect(await handler(validTenderReq)).toEqual({
      kind: 'refused',
      reason: 'no_session',
    });
  });

  it('refuses line_not_applied when the line is unknown', async () => {
    const sessionSource = makeSessionSource(makeSession());
    const handler = createTenderReadHandler({
      getCurrentSession: sessionSource.getCurrentSession,
      attemptsRepo: makeAttemptsRepoDouble([makeAttemptRow()]),
      linesRepo: makeLinesRepoDouble(),
    });
    expect(await handler(validTenderReq)).toEqual({
      kind: 'refused',
      reason: 'line_not_applied',
    });
  });

  it('refuses tenant_isolation when the bound attempt is in another tenant scope', async () => {
    const sessionSource = makeSessionSource(makeSession());
    const row = makeAttemptRow({ tenant_id: 'tenant-OTHER' });
    const linesRepo = makeLinesRepoDouble([makeLineRow({ tender_line_id: 'tl-1' })]);
    const handler = createTenderReadHandler({
      getCurrentSession: sessionSource.getCurrentSession,
      attemptsRepo: makeAttemptsRepoDouble([row]),
      linesRepo,
    });
    expect(await handler(validTenderReq)).toEqual({
      kind: 'refused',
      reason: 'tenant_isolation',
    });
  });

  it('returns the TenderLineRendererView for an applied line', async () => {
    const { handler } = setupRead();
    const result = await handler(validTenderReq);
    expect(result.kind).toBe('ok');
    if (result.kind !== 'ok') return;
    expect(result.tender_line).toMatchObject({
      tender_line_id: 'tl-1',
      tender_type: 'external_card_terminal',
      amount_applied_minor: 2000,
      external_reference: 'AB12XY',
      state: 'applied',
      apply_order: 1,
    });
  });

  it('projection never contains attribution_operator_id, last_action_id, or voucher tokens', async () => {
    const { handler } = setupRead();
    const result = await handler(validTenderReq);
    const serialised = JSON.stringify(result);
    expect(serialised).not.toContain('attribution_operator_id');
    expect(serialised).not.toContain('last_action_id');
    expect(serialised).not.toContain('voucher_redemption_intent_token');
    expect(serialised).not.toContain('voucher_code');
  });
});

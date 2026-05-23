/**
 * F-004 — 006-payments-tender Slice 3 IPC channel registration.
 *
 * Mirrors `src/main/ipc/cart.ts` (005 T029). Every channel is wired to
 * its `payments.*` / `tender.*` handler from
 * `src/main/payments/handlers/`. This file is a thin wire-up: no
 * business logic, only shape validation + delegation.
 *
 * Input shape validation refuses generically per Constitution VII /
 * NFR-003 / PR-2 — a malformed payload collapses to
 * `{ kind: 'refused', reason: 'invalid_input' }` without leaking which
 * field failed validation. The handler itself owns the closed
 * RefusalReason enum; `invalid_input` is the appropriate generic
 * envelope for "renderer sent something we can't parse".
 *
 * `payments.discardOnSessionEnd` is INTERNAL and is NOT registered
 * here. The main-process bootstrap calls it directly when the operator
 * session ends; the renderer cannot trigger it.
 */

import type { IpcMain, IpcMainInvokeEvent } from 'electron';

import { PAYMENTS_IPC_CHANNELS, TENDER_IPC_CHANNELS } from '../../shared/payments/channels.js';
import type { PaymentRefusal, TenderType } from '../../shared/payments/types.js';
import type { PaymentsCancelHandler } from '../payments/handlers/payments-cancel.js';
import type { PaymentsConfirmHandler } from '../payments/handlers/payments-confirm.js';
import type { PaymentsReadHandler } from '../payments/handlers/payments-read.js';
import type { PaymentsStartHandler } from '../payments/handlers/payments-start.js';
import type { PaymentsSubscribeHandler } from '../payments/handlers/payments-subscribe.js';
import type { TenderApplyHandler } from '../payments/handlers/tender-apply.js';
import type { TenderReadHandler } from '../payments/handlers/tender-read.js';
import type { TenderReverseHandler } from '../payments/handlers/tender-reverse.js';
import type {
  PaymentsCancelRequest,
  PaymentsCancelResponse,
  PaymentsConfirmRequest,
  PaymentsConfirmResponse,
  PaymentsReadRequest,
  PaymentsReadResponse,
  PaymentsStartRequest,
  PaymentsStartResponse,
  PaymentsSubscribeRequest,
  PaymentsSubscribeResponse,
  TenderApplyRequest,
  TenderApplyResponse,
  TenderReadRequest,
  TenderReadResponse,
  TenderReverseRequest,
  TenderReverseResponse,
} from '../../shared/bridge-api.js';

export interface PaymentsIpcDeps {
  paymentsStart: PaymentsStartHandler;
  paymentsConfirm: PaymentsConfirmHandler;
  paymentsCancel: PaymentsCancelHandler;
  paymentsSubscribe: PaymentsSubscribeHandler;
  paymentsRead: PaymentsReadHandler;
  tenderApply: TenderApplyHandler;
  tenderReverse: TenderReverseHandler;
  tenderRead: TenderReadHandler;
}

function refuseInvalid(): PaymentRefusal {
  return { kind: 'refused', reason: 'invalid_input' };
}

// ── Payload validators ─────────────────────────────────────────────────────

function asPaymentsStartReq(value: unknown): PaymentsStartRequest | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  if (
    typeof v['envelope_handoff_action_id'] !== 'string' ||
    typeof v['envelope_cart_id'] !== 'string' ||
    typeof v['envelope_subtotal_minor'] !== 'number' ||
    v['envelope_version'] !== 'v1' ||
    typeof v['idempotency_key'] !== 'string'
  ) {
    return null;
  }
  return {
    envelope_handoff_action_id: v['envelope_handoff_action_id'],
    envelope_cart_id: v['envelope_cart_id'],
    envelope_subtotal_minor: v['envelope_subtotal_minor'],
    envelope_version: 'v1',
    idempotency_key: v['idempotency_key'],
  };
}

function asPaymentsConfirmReq(value: unknown): PaymentsConfirmRequest | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  if (typeof v['payment_attempt_id'] !== 'string' || typeof v['idempotency_key'] !== 'string') {
    return null;
  }
  return {
    payment_attempt_id: v['payment_attempt_id'],
    idempotency_key: v['idempotency_key'],
  };
}

function asPaymentsCancelReq(value: unknown): PaymentsCancelRequest | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  if (typeof v['payment_attempt_id'] !== 'string' || typeof v['idempotency_key'] !== 'string') {
    return null;
  }
  return {
    payment_attempt_id: v['payment_attempt_id'],
    idempotency_key: v['idempotency_key'],
  };
}

function asPaymentsSubscribeReq(value: unknown): PaymentsSubscribeRequest | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  if (typeof v['payment_attempt_id'] !== 'string') return null;
  return { payment_attempt_id: v['payment_attempt_id'] };
}

function asPaymentsReadReq(value: unknown): PaymentsReadRequest | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  if (typeof v['payment_attempt_id'] !== 'string') return null;
  return { payment_attempt_id: v['payment_attempt_id'] };
}

const TENDER_TYPES_RUNTIME: readonly TenderType[] = [
  'cash',
  'external_card_terminal',
  'internal_voucher',
];

function isTenderType(value: unknown): value is TenderType {
  return typeof value === 'string' && TENDER_TYPES_RUNTIME.includes(value as TenderType);
}

function asTenderApplyReq(value: unknown): TenderApplyRequest | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  if (
    typeof v['payment_attempt_id'] !== 'string' ||
    !isTenderType(v['tender_type']) ||
    typeof v['amount_applied_minor'] !== 'number' ||
    typeof v['idempotency_key'] !== 'string'
  ) {
    return null;
  }
  const req: TenderApplyRequest = {
    payment_attempt_id: v['payment_attempt_id'],
    tender_type: v['tender_type'],
    amount_applied_minor: v['amount_applied_minor'],
    idempotency_key: v['idempotency_key'],
  };
  // Optional fields — only attach when present + well-typed.
  if (typeof v['external_reference'] === 'string') {
    (req as { external_reference?: string }).external_reference = v['external_reference'];
  }
  if (typeof v['voucher_code'] === 'string') {
    (req as { voucher_code?: string }).voucher_code = v['voucher_code'];
  }
  return req;
}

function asTenderReverseReq(value: unknown): TenderReverseRequest | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  if (typeof v['tender_line_id'] !== 'string' || typeof v['idempotency_key'] !== 'string') {
    return null;
  }
  return {
    tender_line_id: v['tender_line_id'],
    idempotency_key: v['idempotency_key'],
  };
}

function asTenderReadReq(value: unknown): TenderReadRequest | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  if (typeof v['tender_line_id'] !== 'string') return null;
  return { tender_line_id: v['tender_line_id'] };
}

// ── Registration ───────────────────────────────────────────────────────────

export function registerPaymentsHandlers(ipcMain: IpcMain, deps: PaymentsIpcDeps): void {
  ipcMain.handle(
    PAYMENTS_IPC_CHANNELS.START,
    async (_event: IpcMainInvokeEvent, request: unknown): Promise<PaymentsStartResponse> => {
      const req = asPaymentsStartReq(request);
      if (req === null) return refuseInvalid();
      return deps.paymentsStart(req);
    },
  );

  ipcMain.handle(
    PAYMENTS_IPC_CHANNELS.CONFIRM,
    async (_event: IpcMainInvokeEvent, request: unknown): Promise<PaymentsConfirmResponse> => {
      const req = asPaymentsConfirmReq(request);
      if (req === null) return refuseInvalid();
      return deps.paymentsConfirm(req);
    },
  );

  ipcMain.handle(
    PAYMENTS_IPC_CHANNELS.CANCEL,
    async (_event: IpcMainInvokeEvent, request: unknown): Promise<PaymentsCancelResponse> => {
      const req = asPaymentsCancelReq(request);
      if (req === null) return refuseInvalid();
      return deps.paymentsCancel(req);
    },
  );

  ipcMain.handle(
    PAYMENTS_IPC_CHANNELS.SUBSCRIBE,
    async (_event: IpcMainInvokeEvent, request: unknown): Promise<PaymentsSubscribeResponse> => {
      const req = asPaymentsSubscribeReq(request);
      if (req === null) return refuseInvalid();
      return deps.paymentsSubscribe(req);
    },
  );

  ipcMain.handle(
    PAYMENTS_IPC_CHANNELS.READ,
    async (_event: IpcMainInvokeEvent, request: unknown): Promise<PaymentsReadResponse> => {
      const req = asPaymentsReadReq(request);
      if (req === null) return refuseInvalid();
      return deps.paymentsRead(req);
    },
  );

  ipcMain.handle(
    TENDER_IPC_CHANNELS.APPLY,
    async (_event: IpcMainInvokeEvent, request: unknown): Promise<TenderApplyResponse> => {
      const req = asTenderApplyReq(request);
      if (req === null) return refuseInvalid();
      return deps.tenderApply(req);
    },
  );

  ipcMain.handle(
    TENDER_IPC_CHANNELS.REVERSE,
    async (_event: IpcMainInvokeEvent, request: unknown): Promise<TenderReverseResponse> => {
      const req = asTenderReverseReq(request);
      if (req === null) return refuseInvalid();
      return deps.tenderReverse(req);
    },
  );

  ipcMain.handle(
    TENDER_IPC_CHANNELS.READ,
    async (_event: IpcMainInvokeEvent, request: unknown): Promise<TenderReadResponse> => {
      const req = asTenderReadReq(request);
      if (req === null) return refuseInvalid();
      return deps.tenderRead(req);
    },
  );
}

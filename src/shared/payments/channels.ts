/**
 * F-003 — IPC channel constants for the `payments.*` + `tender.*` bridge
 * (006-payments-tender Slice 3).
 *
 * The preload (`src/preload/payments.ts`) and the main-side registration
 * (`src/main/ipc/payments.ts`) both import these constants. Channel
 * names are kebab-cased namespaces — same posture as
 * `src/shared/cart/channels.ts` (005).
 *
 * Slice-3 surface ONLY — `payments.forceFail` (Slice 4) and `vouchers.*`
 * (Slice 4) are intentionally absent. Adding either to the union
 * before §A4-B clears is a contract violation.
 *
 * Note: `payments.discardOnSessionEnd` is internal to the main process
 * and NEVER exposed via contextBridge. It does not appear here.
 */

export const PAYMENTS_IPC_CHANNELS = {
  START: 'payments:start',
  CONFIRM: 'payments:confirm',
  CANCEL: 'payments:cancel',
  SUBSCRIBE: 'payments:subscribe',
  READ: 'payments:read',
} as const;

export type PaymentsIpcChannel = (typeof PAYMENTS_IPC_CHANNELS)[keyof typeof PAYMENTS_IPC_CHANNELS];

export const TENDER_IPC_CHANNELS = {
  APPLY: 'tender:apply',
  REVERSE: 'tender:reverse',
  READ: 'tender:read',
} as const;

export type TenderIpcChannel = (typeof TENDER_IPC_CHANNELS)[keyof typeof TENDER_IPC_CHANNELS];

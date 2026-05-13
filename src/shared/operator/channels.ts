/**
 * 004-operator-session — IPC channel constants for the `operator.*`
 * preload namespace. Lives in `src/shared/` so both the preload bundle
 * (NodeNext, narrow includes) and the main-process bundle can import
 * the same string constants. Renaming any value here is a breaking
 * change to the bridge surface.
 */

export const OPERATOR_IPC_CHANNELS = {
  SIGN_IN: 'operator:sign-in',
  SIGN_OUT: 'operator:sign-out',
  GET_CURRENT_SESSION: 'operator:get-current-session',
  REPORT_ACTIVITY: 'operator:_report-activity',
  EMIT_AUDIT_EVENT: 'operator:emit-audit-event',
  /** T051 — debug bridge smoke; never reachable in production builds. */
  EMIT_AUDIT_EVENT_SMOKE: 'operator:_emit-audit-event-smoke',
  /** T070b — list cashiers on the terminal's paired branch. */
  LIST_BRANCH_ROSTER: 'operator:list-branch-roster',
  /** T070 — confirm a pending takeover via capability token. */
  TAKEOVER_CONFIRM: 'operator:takeover-confirm',
  /** T071 — cancel a pending takeover; pure local discard. */
  TAKEOVER_CANCEL: 'operator:takeover-cancel',
  /** T072 — manager/admin PIN reset for a cashier on this terminal. */
  RESET_CASHIER_PIN: 'operator:reset-cashier-pin',
  /** T073 — manager/admin unlock of a locked-out cashier on this terminal. */
  UNLOCK_CASHIER: 'operator:unlock-cashier',
  /** T089 — manager/admin forced-close of a stuck cashier shift. */
  FORCE_CLOSE_SHIFT: 'operator:force-close-shift',
  /** T090 — list stuck cashier shifts on this terminal's branch. */
  LIST_STUCK_SHIFTS: 'operator:list-stuck-shifts',
  /** T091 — cashier dismisses the forced-close return banner. Zero renderer args. */
  DISMISS_SHIFT_CLOSED_NOTICE: 'operator:dismiss-shift-closed-notice',
} as const;

export type OperatorIpcChannel = (typeof OPERATOR_IPC_CHANNELS)[keyof typeof OPERATOR_IPC_CHANNELS];

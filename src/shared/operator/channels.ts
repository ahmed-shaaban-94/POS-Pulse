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
} as const;

export type OperatorIpcChannel = (typeof OPERATOR_IPC_CHANNELS)[keyof typeof OPERATOR_IPC_CHANNELS];

import { create } from 'zustand';

import type { Role } from '../../shared/operator/role.js';
import type { RefusalCategory } from '../../shared/audit/event-shape.js';

/**
 * 004-operator-session T016 — operator-session FSM (research §3).
 *
 * Five-state machine plus a `takeoverPrompt` branch:
 *
 *     signedOut ── signIn() ──► signingIn ──► signedIn
 *           ▲                       │            │
 *           │                       │            │
 *           │                       └─► takeoverPrompt
 *           │                                    │
 *           │ ◄─ signOut()      signingOut ◄─────┘
 *
 * The store is the renderer-side projection of the operator session.
 * The main-process is the source of truth (in-memory in S1; durable
 * in S3); this store mirrors the visible FSM to drive routing and UI.
 *
 * S1 wires only the manager/admin path. The cashier-PIN-driven
 * transitions land in S4 (and the takeover-confirm UX with them); the
 * `takeoverPrompt` state is reachable here so the FSM is shape-correct
 * end-to-end, but the prompt component itself is S4 territory.
 */

export interface OperatorSessionView {
  /** Operator session id (UUID v4). */
  id: string;
  /** Clerk user id. */
  operator_id: string;
  display_name: string;
  role: Role;
  tenant_id: string;
  branch_id: string;
  /** ISO 8601 UTC timestamp the session was issued. */
  started_at: string;
}

export type OperatorSessionState =
  | { kind: 'signedOut'; lastRefusal?: RefusalCategory }
  | { kind: 'signingIn' }
  | { kind: 'takeoverPrompt' }
  | { kind: 'signedIn'; session: OperatorSessionView }
  | { kind: 'signingOut' };

export interface OperatorSessionStore {
  state: OperatorSessionState;
  /** Begin a sign-in attempt; FSM moves signedOut → signingIn. */
  beginSignIn(): void;
  /** Sign-in resolved with a session; FSM moves signingIn → signedIn. */
  resolveSignedIn(session: OperatorSessionView): void;
  /** Sign-in resolved with takeover-required; FSM moves signingIn → takeoverPrompt. */
  promptTakeover(): void;
  /** Sign-in resolved with refusal; FSM moves signingIn → signedOut (carrying the category). */
  refuseSignIn(category: RefusalCategory): void;
  /** Operator clears the inline refusal (Note 1 — first new keystroke). */
  clearRefusal(): void;
  /** Begin sign-out; FSM moves signedIn → signingOut. */
  beginSignOut(): void;
  /** Sign-out resolved; FSM moves signingOut → signedOut. */
  resolveSignedOut(): void;
  /** Cancel a takeover prompt; FSM moves takeoverPrompt → signedOut. */
  cancelTakeover(): void;
  /** Test-only reset hook — restores the store to its initial state. */
  reset(): void;
}

const INITIAL_STATE: OperatorSessionState = { kind: 'signedOut' };

export const useOperatorSessionStore = create<OperatorSessionStore>((set) => ({
  state: INITIAL_STATE,
  beginSignIn: () => {
    set((s) => {
      if (s.state.kind !== 'signedOut') return s;
      return { state: { kind: 'signingIn' } };
    });
  },
  resolveSignedIn: (session) => {
    set((s) => {
      if (s.state.kind !== 'signingIn' && s.state.kind !== 'takeoverPrompt') return s;
      return { state: { kind: 'signedIn', session } };
    });
  },
  promptTakeover: () => {
    set((s) => {
      if (s.state.kind !== 'signingIn') return s;
      return { state: { kind: 'takeoverPrompt' } };
    });
  },
  refuseSignIn: (category) => {
    set((s) => {
      if (s.state.kind !== 'signingIn') return s;
      return { state: { kind: 'signedOut', lastRefusal: category } };
    });
  },
  clearRefusal: () => {
    set((s) => {
      if (s.state.kind !== 'signedOut' || s.state.lastRefusal === undefined) return s;
      return { state: { kind: 'signedOut' } };
    });
  },
  beginSignOut: () => {
    set((s) => {
      if (s.state.kind !== 'signedIn') return s;
      return { state: { kind: 'signingOut' } };
    });
  },
  resolveSignedOut: () => {
    set((s) => {
      if (s.state.kind !== 'signingOut') return s;
      return { state: { kind: 'signedOut' } };
    });
  },
  cancelTakeover: () => {
    set((s) => {
      if (s.state.kind !== 'takeoverPrompt') return s;
      return { state: { kind: 'signedOut' } };
    });
  },
  reset: () => {
    set({ state: INITIAL_STATE });
  },
}));

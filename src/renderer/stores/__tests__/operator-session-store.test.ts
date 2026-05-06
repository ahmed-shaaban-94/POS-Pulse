import { afterEach, describe, expect, it } from 'vitest';

import { useOperatorSessionStore, type OperatorSessionView } from '../operator-session-store.js';

/**
 * 004-operator-session T011 — operator-session FSM transitions
 * (research §3).
 *
 * Asserts the closed transition graph:
 *
 *   signedOut ─► signingIn ─► signedIn ─► signingOut ─► signedOut
 *                       │
 *                       └─► takeoverPrompt ─► signedOut (cancel)
 *                       └─► takeoverPrompt ─► signedIn   (confirm — S4)
 *                       └─► signedOut (with refusal category)
 *
 * Out-of-graph transitions MUST be no-ops (the store guards every
 * transition by checking the source state — defensive, since stale
 * promises can arrive after a state has already advanced).
 */

const SAMPLE_SESSION: OperatorSessionView = {
  id: 'sess-1',
  operator_id: 'op-1',
  display_name: 'Manager One',
  role: 'manager',
  tenant_id: 't1',
  branch_id: 'b1',
  started_at: '2026-05-06T00:00:00.000Z',
};

afterEach(() => {
  useOperatorSessionStore.getState().reset();
});

describe('operator-session-store FSM (T011)', () => {
  it('starts in signedOut', () => {
    expect(useOperatorSessionStore.getState().state.kind).toBe('signedOut');
  });

  it('signedOut → signingIn → signedIn → signingOut → signedOut', () => {
    const store = useOperatorSessionStore.getState();
    store.beginSignIn();
    expect(useOperatorSessionStore.getState().state.kind).toBe('signingIn');

    store.resolveSignedIn(SAMPLE_SESSION);
    const signedIn = useOperatorSessionStore.getState().state;
    expect(signedIn.kind).toBe('signedIn');
    if (signedIn.kind === 'signedIn') {
      expect(signedIn.session.operator_id).toBe('op-1');
    }

    store.beginSignOut();
    expect(useOperatorSessionStore.getState().state.kind).toBe('signingOut');

    store.resolveSignedOut();
    expect(useOperatorSessionStore.getState().state.kind).toBe('signedOut');
  });

  it('signingIn → takeoverPrompt → signedOut (cancel branch)', () => {
    const store = useOperatorSessionStore.getState();
    store.beginSignIn();
    store.promptTakeover();
    expect(useOperatorSessionStore.getState().state.kind).toBe('takeoverPrompt');
    store.cancelTakeover();
    expect(useOperatorSessionStore.getState().state.kind).toBe('signedOut');
  });

  it('signingIn → takeoverPrompt → signedIn (confirm branch reachable)', () => {
    // Confirm UX wires in S4; the FSM transition itself is reachable now.
    const store = useOperatorSessionStore.getState();
    store.beginSignIn();
    store.promptTakeover();
    store.resolveSignedIn(SAMPLE_SESSION);
    expect(useOperatorSessionStore.getState().state.kind).toBe('signedIn');
  });

  it('signingIn → signedOut on refusal (carries category)', () => {
    const store = useOperatorSessionStore.getState();
    store.beginSignIn();
    store.refuseSignIn('invalid_input');
    const state = useOperatorSessionStore.getState().state;
    expect(state.kind).toBe('signedOut');
    if (state.kind === 'signedOut') {
      expect(state.lastRefusal).toBe('invalid_input');
    }
  });

  it('clearRefusal removes the carried category (Note 1 — first keystroke)', () => {
    const store = useOperatorSessionStore.getState();
    store.beginSignIn();
    store.refuseSignIn('no_connection');
    store.clearRefusal();
    const state = useOperatorSessionStore.getState().state;
    expect(state.kind).toBe('signedOut');
    if (state.kind === 'signedOut') {
      expect(state.lastRefusal).toBeUndefined();
    }
  });

  it('out-of-graph transitions are no-ops (stale promise after state advanced)', () => {
    const store = useOperatorSessionStore.getState();
    // Calling resolveSignedIn while still in signedOut MUST be a no-op.
    store.resolveSignedIn(SAMPLE_SESSION);
    expect(useOperatorSessionStore.getState().state.kind).toBe('signedOut');

    store.beginSignOut(); // signedOut → ... is invalid
    expect(useOperatorSessionStore.getState().state.kind).toBe('signedOut');

    store.cancelTakeover(); // signedOut → ... is invalid
    expect(useOperatorSessionStore.getState().state.kind).toBe('signedOut');

    store.beginSignIn();
    store.promptTakeover();
    // Now in takeoverPrompt; another beginSignIn MUST be a no-op.
    store.beginSignIn();
    expect(useOperatorSessionStore.getState().state.kind).toBe('takeoverPrompt');
  });
});

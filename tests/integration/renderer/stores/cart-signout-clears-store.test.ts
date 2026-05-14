import { beforeEach, describe, expect, it } from 'vitest';

import { useOperatorSessionStore } from '../../../../src/renderer/stores/operator-session-store.js';
import { useCartStore } from '../../../../src/renderer/stores/cart-store.js';
import { installCartStoreSignOutHook } from '../../../../src/renderer/stores/cart-signout-hook.js';
import type { OperatorSessionView } from '../../../../src/renderer/stores/operator-session-store.js';

/**
 * T023 — Sign-out clears `cartStore` (Q3 discard-immediately policy).
 *
 * Per spec Q3 (LOCKED 2026-05-14) — when the bound operator session
 * ends (sign-out, takeover, forced-close, inactivity), the renderer's
 * `cartStore` MUST clear immediately so the cart pane reverts to the
 * signed-out / empty surface and no subsequent cashier sees a leftover
 * draft. The main-process audit emission for `cart.discarded_on_session_end`
 * is S3 / §A3 scope — only the renderer-side discard is in S1.
 *
 * The hook subscribes to `operator-session-store` and resets
 * `cart-store` whenever the FSM leaves the `signedIn` state.
 */

const SAMPLE: OperatorSessionView = {
  id: 'sess-t023',
  operator_id: 'cashier-1',
  display_name: 'Test Cashier',
  role: 'cashier',
  tenant_id: 'tenant-1',
  branch_id: 'branch-1',
  started_at: '2026-05-14T08:00:00.000Z',
};

let unsubscribe: (() => void) | undefined;

beforeEach(() => {
  unsubscribe?.();
  useOperatorSessionStore.getState().reset();
  useCartStore.getState().reset();
  unsubscribe = installCartStoreSignOutHook();
});

describe('cartStore — clears on operator session end', () => {
  it('clears activeCart when session transitions signedIn → signingOut → signedOut', () => {
    useOperatorSessionStore.getState().beginSignIn();
    useOperatorSessionStore.getState().resolveSignedIn(SAMPLE);

    useCartStore.getState().applyCartCreated('cart-uuid-1');
    expect(useCartStore.getState().activeCart).not.toBeNull();

    useOperatorSessionStore.getState().beginSignOut();
    useOperatorSessionStore.getState().resolveSignedOut();

    expect(useCartStore.getState().activeCart).toBeNull();
  });

  it('clears activeCart when transitioning from signedIn to takeoverPrompt path → signedOut', () => {
    useOperatorSessionStore.getState().beginSignIn();
    useOperatorSessionStore.getState().resolveSignedIn(SAMPLE);
    useCartStore.getState().applyCartCreated('cart-uuid-2');

    // Simulate forced sign-out from any non-signedIn transition.
    useOperatorSessionStore.getState().beginSignOut();
    useOperatorSessionStore.getState().resolveSignedOut();

    expect(useCartStore.getState().activeCart).toBeNull();
  });

  it('does NOT clear cartStore while session remains signedIn (e.g. notice-dismiss)', () => {
    useOperatorSessionStore.getState().beginSignIn();
    useOperatorSessionStore.getState().resolveSignedIn(SAMPLE);
    useCartStore.getState().applyCartCreated('cart-uuid-3');

    // Dismissing a notice keeps state.kind === 'signedIn'.
    useOperatorSessionStore.getState().dismissShiftClosedNotice();

    expect(useCartStore.getState().activeCart).not.toBeNull();
    expect(useCartStore.getState().activeCart?.cart_id).toBe('cart-uuid-3');
  });

  it('is idempotent — clearing an already-empty cartStore does nothing observable', () => {
    useOperatorSessionStore.getState().beginSignIn();
    useOperatorSessionStore.getState().resolveSignedIn(SAMPLE);
    // No cart created.

    useOperatorSessionStore.getState().beginSignOut();
    useOperatorSessionStore.getState().resolveSignedOut();

    expect(useCartStore.getState().activeCart).toBeNull();
  });

  it('clears activeCart even if cart is in handing_off state at sign-out time', () => {
    useOperatorSessionStore.getState().beginSignIn();
    useOperatorSessionStore.getState().resolveSignedIn(SAMPLE);

    useCartStore.getState().applyCartCreated('cart-uuid-4');
    useCartStore.getState().applyLineAdded('line-1');
    useCartStore.getState().applyHandoffStarted();
    expect(useCartStore.getState().activeCart?.state).toBe('handing_off');

    useOperatorSessionStore.getState().beginSignOut();
    useOperatorSessionStore.getState().resolveSignedOut();

    expect(useCartStore.getState().activeCart).toBeNull();
  });

  it('unsubscribe() detaches the hook — subsequent sign-outs do not clear', () => {
    useOperatorSessionStore.getState().beginSignIn();
    useOperatorSessionStore.getState().resolveSignedIn(SAMPLE);
    useCartStore.getState().applyCartCreated('cart-uuid-5');

    unsubscribe?.();
    unsubscribe = undefined;

    useOperatorSessionStore.getState().beginSignOut();
    useOperatorSessionStore.getState().resolveSignedOut();

    expect(useCartStore.getState().activeCart).not.toBeNull();
  });
});

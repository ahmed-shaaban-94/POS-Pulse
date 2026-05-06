import type { JSX } from 'react';

import { useOperatorSessionStore } from '../../stores/operator-session-store.js';
import { OperatorBadge } from '../../ui/operator/OperatorBadge.js';

/**
 * 003-pos-ui-shell — role-indicator region.
 * 004-operator-session T031 — OperatorBadge wired here.
 *
 * The OperatorSlot reads from the operator-session store. While a
 * session is active, it renders the OperatorBadge (display name +
 * business-name role). While signed out, it renders the placeholder
 * "Sign in" button retained from 003 for layout continuity.
 *
 * Constitution Principle VIII binding: this slot is the only place in
 * the shell that hints at user identity (FR-020).
 */
export function OperatorSlot(): JSX.Element {
  const state = useOperatorSessionStore((s) => s.state);

  if (state.kind === 'signedIn') {
    return (
      <div className="operator-slot operator-slot--signed-in">
        <OperatorBadge display_name={state.session.display_name} role={state.session.role} />
      </div>
    );
  }

  return (
    <div className="operator-slot">
      <button
        type="button"
        aria-disabled="true"
        tabIndex={-1}
        title="Sign-in is not yet available."
        className="btn btn--ghost btn--md"
      >
        Sign in
      </button>
    </div>
  );
}

import type { JSX } from 'react';

/**
 * Constitution Principle VIII binding: the OperatorSlot is the only place
 * in the shell that hints at user identity. It is visibly disabled and
 * never silently no-ops (spec FR-8 + Constitution VIII).
 */
export function OperatorSlot(): JSX.Element {
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

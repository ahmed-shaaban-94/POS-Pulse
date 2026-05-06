import type { JSX } from 'react';

import type { OperatorBridgeAPI } from '../../shared/bridge-api.js';
import { RosterList } from '../ui/operator/RosterList.js';
import { ManagerAdminSignInForm } from '../ui/operator/ManagerAdminSignInForm.js';

/**
 * 004-operator-session T029 — `/sign-in` route (S1 surface).
 *
 * Mounts above 003's `/app/*` shell. Until an operator session
 * exists, this is the ONLY reachable route on the terminal (FR-005).
 * After successful sign-in the boot router redirects into `/app/*`;
 * sign-out comes back here.
 *
 * S1 renders:
 *   - Surface 1 (`<RosterList>`) inert — visible but with the "manager
 *     / admin sign-in only at this stage" empty-state copy. Data
 *     wiring lands in S4.
 *   - Surface 2 (`<ManagerAdminSignInForm>`) — interactive; drives
 *     the Wave 1 Clerk-JWT sign-in flow.
 *   - Surface 6 generic-failure overlay — implemented inside the
 *     form (the alert/spinner space) so it cannot render alongside a
 *     spinner (Note 1 acceptance).
 */

export interface SignInRouteProps {
  operator: OperatorBridgeAPI;
}

export function SignInRoute(props: SignInRouteProps): JSX.Element {
  return (
    <main data-testid="route-sign-in" className="sign-in-route">
      <div className="sign-in-route__layout">
        <section className="sign-in-route__manager-admin">
          <h1 className="sign-in-route__heading">Sign in</h1>
          <ManagerAdminSignInForm operator={props.operator} />
        </section>
        <aside className="sign-in-route__roster" aria-label="Cashier roster">
          <h2 className="sign-in-route__sub-heading">Cashiers on this branch</h2>
          <RosterList cashiers={[]} inert />
        </aside>
      </div>
    </main>
  );
}

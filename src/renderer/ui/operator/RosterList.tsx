import type { JSX } from 'react';

import { roleDisplayName, type Role } from '../../../shared/operator/role.js';

/**
 * 004-operator-session T030 — RosterList (S1 inert).
 *
 * Renders a list of cashiers with display name + role badge ONLY
 * (FR-006 / FR-031 — no email, no phone, no audit history). S1 leaves
 * this component INERT: the data wiring (calling `operator.list-
 * BranchRoster`) lands with S4 (T070b) under §A1 / §A2 (S4 endpoints).
 *
 * S1 callers pass an empty `cashiers` list; the component renders its
 * own "Manager / admin sign-in only at this stage" empty-state copy
 * so the surface is honest about what's available right now.
 */

export interface RosterEntry {
  id: string;
  display_name: string;
  role: Extract<Role, 'cashier'>;
}

export interface RosterListProps {
  /** Empty in S1; populated from `operator.listBranchRoster` in S4. */
  cashiers: ReadonlyArray<RosterEntry>;
  /**
   * S1: when true, the surface renders the "manager / admin sign-in
   * only at this stage" message. S4 flips this to false on the
   * cashier sign-in surface.
   */
  inert?: boolean;
}

export function RosterList(props: RosterListProps): JSX.Element {
  if (props.inert === true || props.cashiers.length === 0) {
    return (
      <section
        aria-label="Cashier roster"
        data-testid="roster-list"
        data-state="inert"
        className="roster-list roster-list--inert"
      >
        <p className="roster-list__empty">
          Cashier sign-in is not yet available on this terminal. Sign in as a manager or admin to
          continue.
        </p>
      </section>
    );
  }

  return (
    <section
      aria-label="Cashier roster"
      data-testid="roster-list"
      data-state="active"
      className="roster-list"
    >
      <ul className="roster-list__items">
        {props.cashiers.map((c) => (
          <li key={c.id} className="roster-list__item" data-cashier-id={c.id}>
            <span className="roster-list__name">{c.display_name}</span>
            <span className="roster-list__role" data-role={c.role}>
              {roleDisplayName(c.role)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

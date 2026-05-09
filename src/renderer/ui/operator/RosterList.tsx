import type { JSX } from 'react';

import { roleDisplayName, type Role } from '../../../shared/operator/role.js';

/**
 * 004-operator-session T030 / T075 — RosterList.
 *
 * Renders a list of cashiers with display name + role badge ONLY
 * (FR-006 / FR-031 — no email, no phone, no audit history).
 *
 * S1 rendered this inert. S4 (T075) activates selection:
 *   - Pass `onSelect` + `selectedId` to enable interactive mode.
 *   - Each cashier becomes a `<button type="button">` inside its `<li>`.
 *   - `data-cashier-id` and `data-role` are preserved for test targeting.
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
   * S1: when true, the surface renders the inert empty-state message.
   * S4 passes false (or omits) when cashiers are available.
   */
  inert?: boolean;
  /** S4: called when a cashier item is selected. */
  onSelect?: (cashier: RosterEntry) => void;
  /** S4: id of the currently selected cashier (highlights the row). */
  selectedId?: string | undefined;
}

export function RosterList(props: RosterListProps): JSX.Element {
  const { cashiers, inert, onSelect, selectedId } = props;

  if (inert === true || cashiers.length === 0) {
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
      <ul className="roster-list__items" role="listbox" aria-label="Select cashier">
        {cashiers.map((c) => (
          <li
            key={c.id}
            className={`roster-list__item${c.id === selectedId ? ' roster-list__item--selected' : ''}`}
            data-cashier-id={c.id}
            role="option"
            aria-selected={c.id === selectedId}
          >
            {onSelect !== undefined ? (
              <button
                type="button"
                className="roster-list__item-btn"
                data-testid={`roster-item-${c.id}`}
                onClick={() => {
                  onSelect(c);
                }}
              >
                <span className="roster-list__name">{c.display_name}</span>
                <span className="roster-list__role" data-role={c.role}>
                  {roleDisplayName(c.role)}
                </span>
              </button>
            ) : (
              <>
                <span className="roster-list__name">{c.display_name}</span>
                <span className="roster-list__role" data-role={c.role}>
                  {roleDisplayName(c.role)}
                </span>
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

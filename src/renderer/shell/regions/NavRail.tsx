import type { JSX } from 'react';
import { NavLink } from 'react-router-dom';
import { shellNavEntries } from '../../../../specs/003-pos-ui-shell/contracts/shell-routes';
import { useViewportTier } from '../viewport/useViewportTier';

/**
 * NavRail — responsive primary navigation.
 *
 * ≥ 1280 px (expanded): icons + labels.
 * 1024–1279 px (icon-only): icons only, label as aria-label + title tooltip.
 * < 1024 px (too-small): not rendered (AppShell shows ScreenTooSmall instead).
 *
 * Hard exclusion: NO mobile hamburger drawer at any width.
 * (contracts/shell-regions.md §"NavRail" + Spec Clarifications §2)
 */
export function NavRail(): JSX.Element | null {
  const tier = useViewportTier();

  if (tier === 'too-small') return null;

  const iconOnly = tier === 'icon-only';

  return (
    <nav aria-label="Primary" className="nav-rail">
      {shellNavEntries.map((entry) => (
        <NavLink
          key={entry.id}
          to={entry.path}
          aria-label={iconOnly ? entry.label : undefined}
          title={iconOnly ? entry.label : undefined}
          className={({ isActive }) =>
            `nav-rail__entry${isActive ? ' nav-rail__entry--active' : ''}`
          }
          style={{ display: 'flex', minHeight: '44px', minWidth: '44px', alignItems: 'center' }}
        >
          <span aria-hidden="true" data-icon={entry.iconKey} />
          {!iconOnly && <span className="nav-rail__label">{entry.label}</span>}
        </NavLink>
      ))}
    </nav>
  );
}

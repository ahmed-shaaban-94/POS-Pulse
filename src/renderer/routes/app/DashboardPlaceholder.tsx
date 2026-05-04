/**
 * T043 — DashboardPlaceholder with US3 state-variant support.
 *
 * In dev builds, reads `?state=` from the URL via the useDevToggles helper
 * and renders the matching state primitive (LoadingState / EmptyState /
 * ErrorState). Production builds tree-shake the dev branch via the
 * `import.meta.env.DEV` guard.
 */
import type { JSX } from 'react';
import { LoadingState, EmptyState, ErrorState } from '../../ui/states';

function resolveDevState(): string {
  const metaEnv = (import.meta as unknown as { env?: { DEV?: boolean } }).env;
  if (metaEnv?.DEV && typeof window !== 'undefined') {
    return new URLSearchParams(window.location.search).get('state') ?? '';
  }
  return '';
}

export function DashboardPlaceholder(): JSX.Element {
  const devState = resolveDevState();

  if (devState === 'loading') {
    return <LoadingState message="Loading Dashboard…" />;
  }
  if (devState === 'empty') {
    return (
      <EmptyState
        heading="No dashboard data"
        description="There is nothing to display here yet. Check back later."
      />
    );
  }
  if (devState === 'error') {
    return (
      <ErrorState
        heading="Dashboard unavailable"
        description="Could not load the dashboard. Please try again."
      />
    );
  }

  return (
    <section>
      <h1>Dashboard</h1>
      <p>Welcome to POS Pulse. Select an option from the navigation rail.</p>
    </section>
  );
}

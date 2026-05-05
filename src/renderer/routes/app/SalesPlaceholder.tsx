/**
 * T043 — SalesPlaceholder with US3 state-variant support.
 *
 * In dev builds, reads `?state=` from the URL and renders the matching state
 * primitive. Production builds tree-shake the dev branch via the
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

export function SalesPlaceholder(): JSX.Element {
  const devState = resolveDevState();

  if (devState === 'loading') {
    return <LoadingState message="Loading Sales…" />;
  }
  if (devState === 'empty') {
    return (
      <EmptyState heading="No sales records" description="There are no sales records to display." />
    );
  }
  if (devState === 'error') {
    return (
      <ErrorState
        heading="Sales unavailable"
        description="Could not load sales data. Please try again."
      />
    );
  }

  return (
    <section className="placeholder-pane">
      <h1>Sales</h1>
      <p>Sales functionality coming soon.</p>
    </section>
  );
}

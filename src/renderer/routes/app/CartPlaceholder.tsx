/**
 * T043 — CartPlaceholder with US3 state-variant support.
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

export function CartPlaceholder(): JSX.Element {
  const devState = resolveDevState();

  if (devState === 'loading') {
    return <LoadingState message="Loading Cart…" />;
  }
  if (devState === 'empty') {
    return (
      <EmptyState heading="Cart is empty" description="No items have been added to the cart yet." />
    );
  }
  if (devState === 'error') {
    return (
      <ErrorState
        heading="Cart unavailable"
        description="Could not load cart data. Please try again."
      />
    );
  }

  return (
    <section className="placeholder-pane">
      <h1>Cart</h1>
      <p>Cart functionality coming soon.</p>
    </section>
  );
}

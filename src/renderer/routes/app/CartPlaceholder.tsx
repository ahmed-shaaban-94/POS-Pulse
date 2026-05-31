/**
 * T043 — CartPlaceholder with US3 state-variant support.
 *
 * In dev builds, reads `?state=` from the URL and renders the matching state
 * primitive. Production builds tree-shake the dev branch via the
 * `import.meta.env.DEV` guard.
 *
 * 005-sales-cart S1: when the `cart` feature flag is on (read from
 * `feature-flags-store`), this route mounts the live `CartPane` in 003's
 * reserved cart slot. The flag defaults to `false`, so the 003-era
 * placeholder remains the default surface until §A5 sign-off.
 */
import { useCallback, useRef, type JSX } from 'react';
import { LoadingState, EmptyState, ErrorState } from '../../ui/states';
import { Workspace } from '../../shell/regions/Workspace';
import { CartPane, type AddedLineResult } from '../../ui/cart/CartPane';
import { CatalogueSalePane } from '../../ui/catalogue/CatalogueSalePane';
import { useFeatureFlagsStore } from '../../stores/feature-flags-store';

function resolveDevState(): string {
  const metaEnv = (import.meta as unknown as { env?: { DEV?: boolean } }).env;
  if (metaEnv?.DEV && typeof window !== 'undefined') {
    return new URLSearchParams(window.location.search).get('state') ?? '';
  }
  return '';
}

export function CartPlaceholder(): JSX.Element {
  const cartFlag = useFeatureFlagsStore((s) => s.cart);
  const productSearchFlag = useFeatureFlagsStore((s) => s.productSearch);
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

  if (cartFlag) {
    return <CartWorkspace showCatalogue={productSearchFlag} />;
  }

  return (
    <Workspace title="Cart">
      <section className="placeholder-pane">
        <p>Cart functionality coming soon.</p>
      </section>
    </Workspace>
  );
}

/**
 * 009 T049a — Cart workspace with the optional catalogue sale surface.
 *
 * CartPane's `onLineAdded` is a REGISTER-callback: it hands up its internal
 * `addLine(res)` fn. We capture it in a ref and pass a stable wrapper to
 * `CatalogueSalePane`, so a confirmed add flows search → confirm → CartPane's
 * line list — the single write path (FR-20). No parallel cart mutation.
 */
function CartWorkspace({ showCatalogue }: { showCatalogue: boolean }): JSX.Element {
  const addLineRef = useRef<((res: AddedLineResult) => void) | null>(null);
  const registerAddLine = useCallback((addLine: (res: AddedLineResult) => void): void => {
    addLineRef.current = addLine;
  }, []);
  const forwardAddLine = useCallback((res: AddedLineResult): void => {
    addLineRef.current?.(res);
  }, []);

  return (
    <Workspace title="Cart">
      {showCatalogue && <CatalogueSalePane onLineAdded={forwardAddLine} />}
      <CartPane onLineAdded={registerAddLine} />
    </Workspace>
  );
}

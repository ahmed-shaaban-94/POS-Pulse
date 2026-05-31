import { useCallback, useEffect, useRef, type JSX } from 'react';

import type {
  CartBridgeAPI,
  CatalogueBridgeAPI,
  PreloadBridgeAPI,
} from '../../../shared/bridge-api.js';
import type { AddedLineResult } from '../cart/CartPane.js';
import { useCatalogueSearchStore } from '../../stores/catalogueSearchStore.js';
import { useCartStore } from '../../stores/cart-store.js';
import { ProductSearchInput } from './ProductSearchInput.js';
import { ScanCaptureField } from './ScanCaptureField.js';
import { SearchResultList } from './SearchResultList.js';
import { CatalogueAddController } from './CatalogueAddController.js';

/**
 * 009 Slice S5 (T049a) — the live catalogue sale surface.
 *
 * Composition root: (a) typed search → `catalogue.search`; scan →
 * `catalogue.lookupBarcode`; each response maps to the `catalogueSearchStore`
 * FSM. (b) cart lifecycle + `onLineAdded` thread lands in the next task.
 *
 * Bridges are injected (`catalogueBridge`/`cartBridge`) mirroring CartPane's
 * `_testBridge` seam; production reads `window.api`. The FSM's `searching`-guard
 * drops stale responses, so no extra race handling is needed here.
 */
export interface CatalogueSalePaneProps {
  /** The active cart to add into. Optional — the pane sources/creates one from the store. */
  cartId?: string;
  onLineAdded: (res: AddedLineResult) => void;
  catalogueBridge?: CatalogueBridgeAPI;
  cartBridge?: CartBridgeAPI;
}

/* v8 ignore start — only reachable in Electron; jsdom never sets window.api (tests inject bridges) */
function readBridges(): { catalogue: CatalogueBridgeAPI; cart: CartBridgeAPI } {
  const api = (window as unknown as { api?: PreloadBridgeAPI }).api;
  if (!api || api.catalogue === undefined) {
    throw new Error(
      'CatalogueSalePane: window.api.catalogue missing — preload bridge not initialised.',
    );
  }
  return { catalogue: api.catalogue, cart: api.cart };
}
/* v8 ignore stop */

export function CatalogueSalePane({
  cartId,
  onLineAdded,
  catalogueBridge,
  cartBridge,
}: CatalogueSalePaneProps): JSX.Element {
  const state = useCatalogueSearchStore((s) => s.state);
  const activeCart = useCartStore((s) => s.activeCart);
  const creatingRef = useRef(false);

  const getCart = useCallback((): CartBridgeAPI => {
    /* v8 ignore next — readBridges() arm only reachable in Electron; tests inject the bridge */
    return cartBridge ?? readBridges().cart;
  }, [cartBridge]);

  // Eager cart lifecycle: ensure a "current sale" cart exists so a confirmed add
  // always has a target. The renderer's SOLE cart.create caller. `creatingRef`
  // de-dupes against a re-render firing a second create before the first resolves.
  useEffect(() => {
    if (activeCart !== null || creatingRef.current) return;
    creatingRef.current = true;
    void getCart()
      .create({ idempotency_key: crypto.randomUUID() })
      .then((res) => {
        if (res.kind === 'ok') {
          useCartStore.getState().applyCartCreated(res.cart_id);
        }
      })
      /* v8 ignore next 3 — create rejection is an Electron-transport edge; tests script resolves */
      .catch(() => {
        /* leave activeCart null; a later mount/effect retries */
      })
      .finally(() => {
        creatingRef.current = false;
      });
  }, [activeCart, getCart]);

  const effectiveCartId = cartId ?? activeCart?.cart_id ?? '';

  const getCatalogue = useCallback((): CatalogueBridgeAPI => {
    /* v8 ignore next — readBridges() arm only reachable in Electron; tests inject the bridge */
    return catalogueBridge ?? readBridges().catalogue;
  }, [catalogueBridge]);

  const runTypedSearch = useCallback(
    (query: string): void => {
      useCatalogueSearchStore.getState().beginSearch(query);
      void getCatalogue()
        .search({ query })
        .then((res) => {
          const s = useCatalogueSearchStore.getState();
          switch (res.kind) {
            case 'results':
              s.resolveResults(res.items, res.truncated);
              break;
            case 'not_found':
              s.resolveNotFound();
              break;
            case 'catalogue_unavailable':
              s.resolveCatalogueUnavailable();
              break;
            case 'too_short':
            case 'refused':
              s.clear();
              break;
          }
        })
        /* v8 ignore next 3 — bridge invoke rejection is an Electron-transport edge; tests script resolves */
        .catch(() => {
          useCatalogueSearchStore.getState().clear();
        });
    },
    [getCatalogue],
  );

  const runScan = useCallback(
    (barcode: string): void => {
      useCatalogueSearchStore.getState().beginSearch(barcode);
      void getCatalogue()
        .lookupBarcode({ barcode })
        .then((res) => {
          const s = useCatalogueSearchStore.getState();
          switch (res.kind) {
            case 'one':
              s.resolveSingleMatch(res.product);
              break;
            case 'not_found':
              s.resolveNotFound();
              break;
            case 'ambiguous':
              s.resolveAmbiguous();
              break;
            case 'catalogue_unavailable':
              s.resolveCatalogueUnavailable();
              break;
            case 'refused':
              s.clear();
              break;
          }
        })
        /* v8 ignore next 3 — bridge invoke rejection is an Electron-transport edge; tests script resolves */
        .catch(() => {
          useCatalogueSearchStore.getState().clear();
        });
    },
    [getCatalogue],
  );

  const items = state.kind === 'results' ? state.items : [];
  const truncated = state.kind === 'results' ? state.truncated : false;

  return (
    <div className="catalogue-sale-pane" data-testid="catalogue-sale-pane">
      <ProductSearchInput onSearch={runTypedSearch} />
      <ScanCaptureField onScan={runScan} />
      {state.kind === 'results' && (
        <SearchResultList
          items={items}
          truncated={truncated}
          onSelect={(product) => {
            useCatalogueSearchStore.getState().selectResult(product);
          }}
        />
      )}
      {effectiveCartId !== '' && (
        <CatalogueAddController
          cartId={effectiveCartId}
          onLineAdded={onLineAdded}
          {...(cartBridge !== undefined ? { bridge: cartBridge } : {})}
        />
      )}
    </div>
  );
}

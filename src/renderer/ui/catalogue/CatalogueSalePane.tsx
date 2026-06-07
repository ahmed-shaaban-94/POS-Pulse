import { useCallback, useEffect, useRef, type JSX } from 'react';

import type {
  CartBridgeAPI,
  CatalogueBridgeAPI,
  PreloadBridgeAPI,
} from '../../../shared/bridge-api.js';
import type { AddedLineResult } from '../cart/CartPane.js';
import { useCatalogueSearchStore } from '../../stores/catalogueSearchStore.js';
import { useCartStore } from '../../stores/cart-store.js';
import { ProductSearchInput, type ProductSearchInputHandle } from './ProductSearchInput.js';
import { ScanCaptureField } from './ScanCaptureField.js';
import { SearchResultList } from './SearchResultList.js';
import { CatalogueAddController } from './CatalogueAddController.js';
import { NotFoundState } from './NotFoundState.js';
import { AmbiguousBarcodeState } from './AmbiguousBarcodeState.js';
import { CatalogueUnavailableState } from './CatalogueUnavailableState.js';
import { CatalogueFreshness } from './CatalogueFreshness.js';

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
  // `catalogue` is optional on PreloadBridgeAPI (staged wiring), so it MUST be
  // guarded. `cart` is NON-optional (`cart: CartBridgeAPI`), so the type
  // guarantees it once `api` is present — guarding it trips
  // `no-unnecessary-condition`. Narrowing `catalogue` is sufficient.
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
  const searchInputRef = useRef<ProductSearchInputHandle>(null);

  // Clear the FSM to idle and return focus to the search input — the S0
  // recovery contract for every terminal error surface (FR-6/7 keyboard
  // recovery: "every terminal state returns focus to the input").
  const recoverToInput = useCallback((): void => {
    useCatalogueSearchStore.getState().clear();
    searchInputRef.current?.focus();
  }, []);

  const getCart = useCallback((): CartBridgeAPI => {
    /* v8 ignore next — readBridges() arm only reachable in Electron; tests inject the bridge */
    return cartBridge ?? readBridges().cart;
  }, [cartBridge]);

  // Eager cart lifecycle: ensure a "current sale" cart exists so a confirmed add
  // always has a target. The renderer's SOLE cart.create caller. `creatingRef`
  // de-dupes against a re-render firing a second create before the first resolves.
  useEffect(() => {
    // An explicit `cartId` means the caller already owns a cart target — never
    // create a redundant/orphan one (the prop is the authority when supplied).
    if (cartId !== undefined && cartId !== '') return;
    if (activeCart !== null || creatingRef.current) return;
    creatingRef.current = true;
    void getCart()
      .create({ idempotency_key: crypto.randomUUID() })
      .then((res) => {
        if (res.kind === 'ok') {
          useCartStore.getState().applyCartCreated(res.cart_id);
        }
      })
      .catch(() => {
        // A rejected create (IPC transport edge) leaves activeCart null; a later
        // mount/effect retries. Swallowed so the effect never throws.
      })
      .finally(() => {
        creatingRef.current = false;
      });
  }, [activeCart, cartId, getCart]);

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
        .catch(() => {
          // A rejected bridge invoke (IPC transport edge) degrades to idle —
          // never leaves the FSM stuck in `searching`.
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
        .catch(() => {
          // A rejected bridge invoke (IPC transport edge) degrades to idle —
          // never leaves the FSM stuck in `searching`.
          useCatalogueSearchStore.getState().clear();
        });
    },
    [getCatalogue],
  );

  const items = state.kind === 'results' ? state.items : [];
  const truncated = state.kind === 'results' ? state.truncated : false;

  return (
    <div className="catalogue-sale-pane" data-testid="catalogue-sale-pane">
      {/* 010 — catalogue freshness header (FR-16): the truthful last-updated
          line + manual refresh. Reads window.api.catalogue itself; in tests a
          `catalogueBridge` is injected, so honour the same seam to avoid hitting
          window.api under jsdom. */}
      <CatalogueFreshness {...(catalogueBridge !== undefined ? { bridge: catalogueBridge } : {})} />
      <ProductSearchInput ref={searchInputRef} onSearch={runTypedSearch} />
      <ScanCaptureField onScan={runScan} />
      {/* In-flight surface (T050 F2 / Surface 2): the bridge call is pending.
          `aria-busy` announces the wait; no spin glyph so reduced-motion is
          honoured by construction. No controls of its own (a new scan/keystroke
          supersedes via the input). */}
      {state.kind === 'searching' && (
        <p
          className="catalogue-searching"
          data-testid="catalogue-searching"
          role="status"
          aria-busy="true"
        >
          جارٍ البحث… (searching…)
        </p>
      )}
      {state.kind === 'results' && (
        <SearchResultList
          items={items}
          truncated={truncated}
          onSelect={(product) => {
            useCatalogueSearchStore.getState().selectResult(product);
          }}
        />
      )}
      {/* Error-state surfaces (T050 F1): the FSM reaches these via the bridge
          response mappings above, so the live pane MUST mount them or the screen
          goes blank. `onEdit` clears the FSM to idle for the next scan (FR-6/7
          recovery). The danger/warning/muted treatments are owned by the
          components (SC-10 — three distinct error states). */}
      {state.kind === 'not_found' && <NotFoundState query={state.query} onEdit={recoverToInput} />}
      {state.kind === 'ambiguous' && <AmbiguousBarcodeState onEdit={recoverToInput} />}
      {state.kind === 'catalogue_unavailable' && <CatalogueUnavailableState />}
      {effectiveCartId !== '' && (
        <CatalogueAddController
          cartId={effectiveCartId}
          onLineAdded={onLineAdded}
          onResolved={() => searchInputRef.current?.focus()}
          {...(cartBridge !== undefined ? { bridge: cartBridge } : {})}
        />
      )}
    </div>
  );
}

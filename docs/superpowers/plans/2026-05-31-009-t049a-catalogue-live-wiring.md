# 009 T049a — Catalogue Live Wiring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make scan/search → confirm → add-to-cart runnable end-to-end by wiring the catalogue surface into the Cart workspace (behind a new fail-closed `productSearch` flag), driving the search FSM from the `catalogue.*` bridge, and creating a cart eagerly so confirmed adds land as cart lines.

**Architecture:** A new `CatalogueSalePane` renderer container is the composition root. It (a) calls `catalogue.search` (typed) / `catalogue.lookupBarcode` (scan) and maps each response to the `catalogueSearchStore` FSM; (b) eagerly creates a cart on mount with an active session, threads `CartPane`'s `onLineAdded` register-callback to the unchanged `CatalogueAddController`, and renders the search/scan/result/confirm surfaces. `CartPlaceholder` mounts it only when `cart && productSearch` are both on.

**Tech Stack:** React 19, Zustand, TypeScript 5.6 (strict), Vitest + @testing-library/react, Electron preload bridge (`window.api`). Tests inject the bridge (`_testBridge`) and a fake session — decoupled from the real (empty) read model.

**Design:** `docs/superpowers/specs/2026-05-31-009-t049a-catalogue-live-wiring-design.md`

---

## File Structure

| File | Responsibility |
|:--|:--|
| `src/shared/app-config.ts` | Add `productSearch?: boolean` to `AppConfig.features`. |
| `src/main/index.ts` | `getAppConfig`: read `POS_PULSE_FEATURE_PRODUCT_SEARCH`; add to `cfg.features`. |
| `src/renderer/stores/feature-flags-store.ts` | Add `productSearch` to state, hydrate param, INITIAL. |
| `src/renderer/ui/catalogue/CatalogueSalePane.tsx` | **NEW** — composition root: search-exec wiring (a) + cart lifecycle + onLineAdded thread (b). |
| `src/renderer/ui/catalogue/__tests__/CatalogueSalePane.test.tsx` | **NEW** — wiring + lifecycle tests (injected bridge). |
| `src/renderer/routes/app/CartPlaceholder.tsx` | Mount `CatalogueSalePane` under `cart && productSearch`; thread `CartPane.onLineAdded`. |
| `src/renderer/routes/app/__tests__/CartPlaceholder.test.tsx` | Gating test (mounts only when both flags on). |
| `specs/009-product-search-and-barcode-lookup/tasks.md` | Mark T049a done with as-built notes. |

**Note on the search FSM contract (already built, do not change):**
`useCatalogueSearchStore.getState()` exposes: `beginSearch(query)`, `resolveResults(items, truncated)`, `resolveNotFound()`, `resolveAmbiguous()`, `resolveCatalogueUnavailable()`, `resolveSingleMatch(product)`, `selectResult(product)`, `confirmAdd()`, `cancelConfirm()`, `clear()`, `reset()`. State kinds: `idle | searching | results | not_found | ambiguous | catalogue_unavailable | confirm_pending`. Every resolver no-ops unless the current state is `searching` (stale-response guard) — except `selectResult` (guards on `results`).

**Bridge response shapes (from `src/shared/bridge-api.ts`):**
- `catalogue.search({ query })` → `{ kind: 'results', items, truncated } | { kind: 'not_found' } | { kind: 'too_short' } | { kind: 'catalogue_unavailable' } | { kind: 'refused', reason }`
- `catalogue.lookupBarcode({ barcode })` → `{ kind: 'one', product } | { kind: 'not_found' } | { kind: 'ambiguous' } | { kind: 'catalogue_unavailable' } | { kind: 'refused', reason }`

---

## Task 1: Add the `productSearch` feature flag (shared + main + store)

**Files:**
- Modify: `src/shared/app-config.ts:35-56`
- Modify: `src/main/index.ts` (the `getAppConfig` closure, ~lines 385-422)
- Modify: `src/renderer/stores/feature-flags-store.ts:15-46`
- Test: `src/renderer/stores/__tests__/feature-flags-store.test.ts` (modify if exists, else create)

- [ ] **Step 1: Write the failing store test**

Check whether `src/renderer/stores/__tests__/feature-flags-store.test.ts` exists (`ls src/renderer/stores/__tests__/`). If it exists, append the cases below; if not, create it with this full content:

```tsx
import { afterEach, describe, expect, it } from 'vitest';
import { useFeatureFlagsStore } from '../feature-flags-store.js';

afterEach(() => {
  useFeatureFlagsStore.getState().reset();
});

describe('feature-flags-store — productSearch (009 T049a)', () => {
  it('defaults productSearch to false (fail-closed)', () => {
    expect(useFeatureFlagsStore.getState().productSearch).toBe(false);
  });

  it('hydrates productSearch from the flag map', () => {
    useFeatureFlagsStore.getState().hydrate({ productSearch: true });
    expect(useFeatureFlagsStore.getState().productSearch).toBe(true);
  });

  it('hydrate without productSearch leaves it false', () => {
    useFeatureFlagsStore.getState().hydrate({ cart: true });
    expect(useFeatureFlagsStore.getState().productSearch).toBe(false);
  });

  it('reset restores productSearch to false', () => {
    useFeatureFlagsStore.getState().hydrate({ productSearch: true });
    useFeatureFlagsStore.getState().reset();
    expect(useFeatureFlagsStore.getState().productSearch).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/renderer/stores/__tests__/feature-flags-store.test.ts`
Expected: FAIL — `productSearch` does not exist on the store (TS strip lets it run; `expect(undefined).toBe(false)` fails).

- [ ] **Step 3: Add `productSearch` to the renderer store**

In `src/renderer/stores/feature-flags-store.ts`:

Add to `FeatureFlagsState` (after the `saleFinalization` line, ~line 20):
```ts
  /** 009-product-search-and-barcode-lookup T049a: enables the catalogue search/scan/add surface. Fail-closed default: false. */
  productSearch: boolean;
```

Change the `hydrate` signature (line 26):
```ts
  hydrate(flags: {
    cart?: boolean;
    payments?: boolean;
    saleFinalization?: boolean;
    productSearch?: boolean;
  }): void;
```

Add to `INITIAL` (after `saleFinalization: false,`, ~line 33):
```ts
  productSearch: false,
```

Add to the `hydrate` body `set({...})` (after the `saleFinalization:` line, ~line 43):
```ts
      productSearch: flags.productSearch === true,
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/renderer/stores/__tests__/feature-flags-store.test.ts`
Expected: PASS.

- [ ] **Step 5: Add `productSearch` to the shared `AppConfig`**

In `src/shared/app-config.ts`, inside the `features` object (after the `saleFinalization?: boolean;` field, ~line 55):
```ts
    /**
     * 009-product-search-and-barcode-lookup T049a — enables the catalogue
     * search/scan/confirm/add surface in the Cart workspace.
     *
     * Defaults to `false`. Flip via `POS_PULSE_FEATURE_PRODUCT_SEARCH` in main.
     * Fail-closed: disabled keeps the cart surface search-free. Independent of
     * the `cart` flag, but the surface mounts only when BOTH are on (it needs
     * CartPane present to receive added lines).
     */
    productSearch?: boolean;
```

- [ ] **Step 6: Read `POS_PULSE_FEATURE_PRODUCT_SEARCH` in main**

In `src/main/index.ts`, inside the `getAppConfig` closure. After the `saleFinalizationEnabled` block (just before `cfg.features = {`), add:
```ts
      // 009-product-search-and-barcode-lookup T049a — productSearch flag (default false).
      // Same truthy-value contract as cart. Mounts the catalogue surface only when
      // BOTH this and `cart` are on (the surface needs CartPane to receive lines).
      const productSearchRaw = process.env['POS_PULSE_FEATURE_PRODUCT_SEARCH'];
      const productSearchEnabled =
        typeof productSearchRaw === 'string' &&
        ['1', 'true', 'yes', 'on'].includes(productSearchRaw.trim().toLowerCase());
```

Then add `productSearch: productSearchEnabled,` to the `cfg.features = { ... }` object literal (after `saleFinalization: saleFinalizationEnabled,`).

- [ ] **Step 7: Verify typecheck + the store test**

Run: `npm run typecheck`
Expected: clean (all three tsconfigs).
Run: `npx vitest run src/renderer/stores/__tests__/feature-flags-store.test.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/shared/app-config.ts src/main/index.ts src/renderer/stores/feature-flags-store.ts src/renderer/stores/__tests__/feature-flags-store.test.ts
git commit -m "feat(009): add fail-closed productSearch feature flag (T049a)"
```

---

## Task 2: `CatalogueSalePane` — search-execution wiring (a)

This task builds the container and the search/scan → bridge → FSM wiring. Cart lifecycle (b) is Task 3 (the same file, extended). We build (a) first so each commit is green.

**Files:**
- Create: `src/renderer/ui/catalogue/CatalogueSalePane.tsx`
- Test: `src/renderer/ui/catalogue/__tests__/CatalogueSalePane.test.tsx`

- [ ] **Step 1: Write the failing search-wiring test**

Create `src/renderer/ui/catalogue/__tests__/CatalogueSalePane.test.tsx`:

```tsx
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import { CatalogueSalePane } from '../CatalogueSalePane.js';
import { useCatalogueSearchStore } from '../../../stores/catalogueSearchStore.js';
import type { CartBridgeAPI, CatalogueBridgeAPI } from '../../../../shared/bridge-api.js';
import type { ProductSnapshotDisplay } from '../../../../shared/catalogue/product-snapshot.js';

const PRODUCT: ProductSnapshotDisplay = {
  product_id: 'p-1',
  display_name_ar: 'بنادول إكسترا',
  price_minor: 1500,
  active: true,
  controlled_substance: false,
  prescription_required: false,
};

/** A catalogue bridge with scripted search + lookupBarcode. */
function catalogueBridge(over: Partial<CatalogueBridgeAPI> = {}): CatalogueBridgeAPI {
  return {
    lookupBarcode: vi.fn(),
    lookupSku: vi.fn(),
    search: vi.fn(),
    resolve: vi.fn(),
    ...over,
  } as unknown as CatalogueBridgeAPI;
}

/** A cart bridge whose create resolves ok (Task 3 exercises this further). */
function cartBridge(): CartBridgeAPI {
  return {
    create: vi.fn().mockResolvedValue({ kind: 'ok', cart_id: 'cart-1' }),
    lines: { add: vi.fn(), update: vi.fn(), remove: vi.fn(), setNote: vi.fn() },
    discountPlaceholders: { add: vi.fn(), remove: vi.fn() },
    void: vi.fn(),
    handoff: vi.fn(),
    subscribe: vi.fn(),
  } as unknown as CartBridgeAPI;
}

beforeEach(() => {
  useCatalogueSearchStore.getState().reset();
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('CatalogueSalePane — typed search → FSM (T049a wiring a)', () => {
  it('a typed search calls catalogue.search and drives the FSM to results', async () => {
    const search = vi
      .fn()
      .mockResolvedValue({ kind: 'results', items: [PRODUCT], truncated: false });
    render(
      <CatalogueSalePane
        cartId="cart-1"
        onLineAdded={vi.fn()}
        catalogueBridge={catalogueBridge({ search })}
        cartBridge={cartBridge()}
      />,
    );

    const input = screen.getByRole('searchbox');
    fireEvent.change(input, { target: { value: 'بنادول' } });
    fireEvent.keyDown(input, { key: 'Enter' }); // submit immediately (bypass debounce)

    await waitFor(() => {
      expect(search).toHaveBeenCalledWith({ query: 'بنادول' });
    });
    await waitFor(() => {
      expect(useCatalogueSearchStore.getState().state.kind).toBe('results');
    });
  });

  it('maps not_found / catalogue_unavailable search responses to the FSM', async () => {
    const search = vi.fn().mockResolvedValue({ kind: 'catalogue_unavailable' });
    render(
      <CatalogueSalePane
        cartId="cart-1"
        onLineAdded={vi.fn()}
        catalogueBridge={catalogueBridge({ search })}
        cartBridge={cartBridge()}
      />,
    );
    const input = screen.getByRole('searchbox');
    fireEvent.change(input, { target: { value: 'xyz' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(useCatalogueSearchStore.getState().state.kind).toBe('catalogue_unavailable');
    });
  });
});

describe('CatalogueSalePane — scan → exact lookup → FSM (T049a wiring a)', () => {
  it('a scan calls catalogue.lookupBarcode and a single match → confirm_pending', async () => {
    const lookupBarcode = vi.fn().mockResolvedValue({ kind: 'one', product: PRODUCT });
    render(
      <CatalogueSalePane
        cartId="cart-1"
        onLineAdded={vi.fn()}
        catalogueBridge={catalogueBridge({ lookupBarcode })}
        cartBridge={cartBridge()}
      />,
    );

    const scan = screen.getByTestId('scan-capture-field');
    fireEvent.change(scan, { target: { value: '6221000000001' } });
    fireEvent.keyDown(scan, { key: 'Enter' });

    await waitFor(() => {
      expect(lookupBarcode).toHaveBeenCalledWith({ barcode: '6221000000001' });
    });
    await waitFor(() => {
      const s = useCatalogueSearchStore.getState().state;
      expect(s.kind).toBe('confirm_pending');
    });
  });

  it('an ambiguous scan → ambiguous state (FR-7)', async () => {
    const lookupBarcode = vi.fn().mockResolvedValue({ kind: 'ambiguous' });
    render(
      <CatalogueSalePane
        cartId="cart-1"
        onLineAdded={vi.fn()}
        catalogueBridge={catalogueBridge({ lookupBarcode })}
        cartBridge={cartBridge()}
      />,
    );
    const scan = screen.getByTestId('scan-capture-field');
    fireEvent.change(scan, { target: { value: '111' } });
    fireEvent.keyDown(scan, { key: 'Enter' });

    await waitFor(() => {
      expect(useCatalogueSearchStore.getState().state.kind).toBe('ambiguous');
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/renderer/ui/catalogue/__tests__/CatalogueSalePane.test.tsx`
Expected: FAIL — `Failed to resolve import "../CatalogueSalePane.js"`.

- [ ] **Step 3: Implement `CatalogueSalePane` with search-execution wiring**

Create `src/renderer/ui/catalogue/CatalogueSalePane.tsx`:

```tsx
import { useCallback, type JSX } from 'react';

import type {
  CartBridgeAPI,
  CatalogueBridgeAPI,
  PreloadBridgeAPI,
} from '../../../shared/bridge-api.js';
import type { AddedLineResult } from '../cart/CartPane.js';
import { useCatalogueSearchStore } from '../../stores/catalogueSearchStore.js';
import { ProductSearchInput } from './ProductSearchInput.js';
import { ScanCaptureField } from './ScanCaptureField.js';
import { SearchResultList } from './SearchResultList.js';
import { CatalogueAddController } from './CatalogueAddController.js';

/**
 * 009 Slice S5 (T049a) — the live catalogue sale surface.
 *
 * Composition root that makes scan/search → confirm → add runnable:
 *   (a) typed search → `catalogue.search`; scan → `catalogue.lookupBarcode`;
 *       each response maps to the `catalogueSearchStore` FSM.
 *   (b) eager cart lifecycle + `onLineAdded` thread to `CatalogueAddController`
 *       (added in Task 3).
 *
 * Bridges are injected (`catalogueBridge` / `cartBridge`) mirroring CartPane's
 * `_testBridge` seam; production reads `window.api`. The FSM's `searching`-guard
 * drops stale responses, so no extra race handling is needed here.
 */
export interface CatalogueSalePaneProps {
  /** The active cart to add into (Task 3 makes this resilient to a null cart). */
  cartId: string;
  /** CartPane's confirmed-line sink (the single cart-line write path, FR-20). */
  onLineAdded: (res: AddedLineResult) => void;
  /** Test-only catalogue bridge injection. Production reads `window.api.catalogue`. */
  catalogueBridge?: CatalogueBridgeAPI;
  /** Test-only cart bridge injection. Production reads `window.api.cart`. */
  cartBridge?: CartBridgeAPI;
}

/* v8 ignore start — only reachable in Electron; jsdom never sets window.api (tests inject bridges) */
function readBridges(): { catalogue: CatalogueBridgeAPI; cart: CartBridgeAPI } {
  const api = (window as unknown as { api?: PreloadBridgeAPI }).api;
  if (!api || api.catalogue === undefined) {
    throw new Error('CatalogueSalePane: window.api.catalogue missing — preload bridge not initialised.');
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

  const getCatalogue = useCallback((): CatalogueBridgeAPI => {
    /* v8 ignore next — readBridges() arm only reachable in Electron; tests inject the bridge */
    return catalogueBridge ?? readBridges().catalogue;
  }, [catalogueBridge]);

  // Typed name search → catalogue.search → FSM.
  const runTypedSearch = useCallback(
    (query: string): void => {
      const store = useCatalogueSearchStore.getState();
      store.beginSearch(query);
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
              // Defensive: the input min-2-guards; a gate refusal is renderer-
              // invisible (NFR-6a). Drop back to idle.
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

  // Scan (wedge terminator) → exact barcode lookup → FSM.
  const runScan = useCallback(
    (barcode: string): void => {
      const store = useCatalogueSearchStore.getState();
      store.beginSearch(barcode);
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
      <CatalogueAddController
        cartId={cartId}
        onLineAdded={onLineAdded}
        {...(cartBridge !== undefined ? { bridge: cartBridge } : {})}
      />
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/renderer/ui/catalogue/__tests__/CatalogueSalePane.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/ui/catalogue/CatalogueSalePane.tsx src/renderer/ui/catalogue/__tests__/CatalogueSalePane.test.tsx
git commit -m "feat(009): CatalogueSalePane search/scan execution wiring (T049a wiring a)"
```

---

## Task 3: `CatalogueSalePane` — eager cart lifecycle + onLineAdded thread (b)

Extend `CatalogueSalePane` so it creates a cart eagerly when one isn't present and an
operator session is active. The `cartId` prop becomes optional (the pane sources it from
the store / its own create).

**Files:**
- Modify: `src/renderer/ui/catalogue/CatalogueSalePane.tsx`
- Test: `src/renderer/ui/catalogue/__tests__/CatalogueSalePane.test.tsx` (add cases)

- [ ] **Step 1: Write the failing lifecycle test**

Append to `src/renderer/ui/catalogue/__tests__/CatalogueSalePane.test.tsx`:

```tsx
import { useCartStore } from '../../../stores/cart-store.js';

describe('CatalogueSalePane — eager cart lifecycle (T049a wiring b)', () => {
  beforeEach(() => {
    useCartStore.getState().reset();
  });

  it('creates a cart on mount when none exists, then records it in the store', async () => {
    const create = vi.fn().mockResolvedValue({ kind: 'ok', cart_id: 'cart-new' });
    const cb = {
      create,
      lines: { add: vi.fn(), update: vi.fn(), remove: vi.fn(), setNote: vi.fn() },
      discountPlaceholders: { add: vi.fn(), remove: vi.fn() },
      void: vi.fn(),
      handoff: vi.fn(),
      subscribe: vi.fn(),
    } as unknown as CartBridgeAPI;

    render(
      <CatalogueSalePane onLineAdded={vi.fn()} catalogueBridge={catalogueBridge()} cartBridge={cb} />,
    );

    await waitFor(() => {
      expect(create).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(useCartStore.getState().activeCart?.cart_id).toBe('cart-new');
    });
  });

  it('does NOT create a cart when one already exists', async () => {
    useCartStore.getState().applyCartCreated('cart-existing');
    const create = vi.fn();
    const cb = {
      create,
      lines: { add: vi.fn(), update: vi.fn(), remove: vi.fn(), setNote: vi.fn() },
      discountPlaceholders: { add: vi.fn(), remove: vi.fn() },
      void: vi.fn(),
      handoff: vi.fn(),
      subscribe: vi.fn(),
    } as unknown as CartBridgeAPI;

    render(
      <CatalogueSalePane onLineAdded={vi.fn()} catalogueBridge={catalogueBridge()} cartBridge={cb} />,
    );

    // Give any effect a tick; create must not fire.
    await new Promise((r) => setTimeout(r, 0));
    expect(create).not.toHaveBeenCalled();
  });
});
```

Note: the existing Task-2 tests pass `cartId="cart-1"`. After this task `cartId` is optional;
those tests still compile (an extra prop is allowed) — leave them as-is.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/renderer/ui/catalogue/__tests__/CatalogueSalePane.test.tsx -t "eager cart lifecycle"`
Expected: FAIL — no `create` call (the pane doesn't create a cart yet).

- [ ] **Step 3: Add the eager-create effect + store-sourced cartId**

In `src/renderer/ui/catalogue/CatalogueSalePane.tsx`:

Change the imports — add `useEffect` and the cart store:
```tsx
import { useCallback, useEffect, useRef, type JSX } from 'react';
```
```tsx
import { useCartStore } from '../../stores/cart-store.js';
```

Make `cartId` optional in the props interface:
```tsx
  /** The active cart to add into. Optional — the pane sources/creates one from the store. */
  cartId?: string;
```

Replace the component body's opening (the `const state = ...` line) and add the lifecycle, sourcing `cartId` from the store when not provided:

```tsx
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
```

Then change the `CatalogueAddController` usage to pass `effectiveCartId` and render it only
when a cart exists (so an add never fires against an empty cartId):
```tsx
      {effectiveCartId !== '' && (
        <CatalogueAddController
          cartId={effectiveCartId}
          onLineAdded={onLineAdded}
          {...(cartBridge !== undefined ? { bridge: cartBridge } : {})}
        />
      )}
```

- [ ] **Step 4: Run the lifecycle tests to verify they pass**

Run: `npx vitest run src/renderer/ui/catalogue/__tests__/CatalogueSalePane.test.tsx`
Expected: PASS (all cases — Task 2 + Task 3).

- [ ] **Step 5: Typecheck + lint**

Run: `npm run typecheck`
Expected: clean.
Run: `npx eslint src/renderer/ui/catalogue/CatalogueSalePane.tsx`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/ui/catalogue/CatalogueSalePane.tsx src/renderer/ui/catalogue/__tests__/CatalogueSalePane.test.tsx
git commit -m "feat(009): eager cart lifecycle + cartId sourcing in CatalogueSalePane (T049a wiring b)"
```

---

## Task 4: Mount `CatalogueSalePane` in `CartPlaceholder` behind `cart && productSearch`

**Files:**
- Modify: `src/renderer/routes/app/CartPlaceholder.tsx`
- Test: `src/renderer/routes/app/__tests__/CartPlaceholder.test.tsx` (modify if exists, else create)

- [ ] **Step 1: Write the failing gating test**

Check `ls src/renderer/routes/app/__tests__/` for an existing `CartPlaceholder.test.tsx`. If present, append; else create with this content:

```tsx
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom/vitest';

import { CartPlaceholder } from '../CartPlaceholder.js';
import { useFeatureFlagsStore } from '../../../stores/feature-flags-store.js';
import { useOperatorSessionStore } from '../../../stores/operator-session-store.js';

function renderPlaceholder() {
  return render(
    <MemoryRouter>
      <CartPlaceholder />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  useFeatureFlagsStore.getState().reset();
  useOperatorSessionStore.getState().reset();
  // CartPane renders only when signed in; seed a signed-in session.
  useOperatorSessionStore.getState().hydrateSignedIn({
    operator_id: 'op-1',
    display_name: 'Cashier',
    role: 'cashier',
    tenant_id: 'tenant-1',
    branch_id: 'branch-1',
  });
});
afterEach(() => {
  cleanup();
});

describe('CartPlaceholder — catalogue surface gating (T049a)', () => {
  it('mounts the catalogue surface when cart AND productSearch are on', () => {
    useFeatureFlagsStore.getState().hydrate({ cart: true, productSearch: true });
    renderPlaceholder();
    expect(screen.getByTestId('catalogue-sale-pane')).toBeInTheDocument();
  });

  it('does NOT mount the catalogue surface when productSearch is off', () => {
    useFeatureFlagsStore.getState().hydrate({ cart: true, productSearch: false });
    renderPlaceholder();
    expect(screen.queryByTestId('catalogue-sale-pane')).not.toBeInTheDocument();
  });

  it('does NOT mount the catalogue surface when cart is off', () => {
    useFeatureFlagsStore.getState().hydrate({ cart: false, productSearch: true });
    renderPlaceholder();
    expect(screen.queryByTestId('catalogue-sale-pane')).not.toBeInTheDocument();
  });
});
```

Note: verify the `hydrateSignedIn` argument shape against `OperatorSessionView`
(`src/renderer/stores/operator-session-store.ts`). If the field names differ, match them —
the test just needs a signed-in session so CartPane renders.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/renderer/routes/app/__tests__/CartPlaceholder.test.tsx`
Expected: FAIL — `catalogue-sale-pane` not found (CartPlaceholder doesn't mount it).

- [ ] **Step 3: Mount the surface + thread onLineAdded**

In `src/renderer/routes/app/CartPlaceholder.tsx`:

Add imports:
```tsx
import { useRef, useCallback } from 'react';
import { CatalogueSalePane } from '../../ui/catalogue/CatalogueSalePane';
import type { AddedLineResult } from '../../ui/cart/CartPane';
```

Read the second flag inside the component (after the `cartFlag` line):
```tsx
  const productSearchFlag = useFeatureFlagsStore((s) => s.productSearch);
```

Replace the `if (cartFlag) { return (<Workspace title="Cart"><CartPane /></Workspace>); }`
block with one that threads `onLineAdded` and conditionally mounts the catalogue surface:
```tsx
  if (cartFlag) {
    return <CartWorkspace showCatalogue={productSearchFlag} />;
  }
```

Then add this child component below `CartPlaceholder` (so the `addLine` ref + register
callback are scoped to a component that owns them — CartPane's `onLineAdded` is a
register-callback `(addLine) => void`):
```tsx
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/renderer/routes/app/__tests__/CartPlaceholder.test.tsx`
Expected: PASS (3 gating cases).

- [ ] **Step 5: Typecheck + lint**

Run: `npm run typecheck`
Expected: clean.
Run: `npx eslint src/renderer/routes/app/CartPlaceholder.tsx`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/routes/app/CartPlaceholder.tsx src/renderer/routes/app/__tests__/CartPlaceholder.test.tsx
git commit -m "feat(009): mount CatalogueSalePane in Cart workspace behind cart && productSearch (T049a)"
```

---

## Task 5: Full verification, coverage, tasks.md, PR

**Files:**
- Modify: `specs/009-product-search-and-barcode-lookup/tasks.md`

- [ ] **Step 1: Full gates**

Run each; all must pass:
```bash
npm run typecheck
npm run lint
npm run codegen:verify
npx vitest run --coverage
```
Expected: typecheck clean; lint clean (eslint + prettier); codegen up to date; coverage EXIT 0 (no threshold errors — in particular `CatalogueSalePane.tsx` meets the `src/renderer/ui/**` ≥90% floor). If `CatalogueSalePane.tsx` is below the floor, add the missing-branch test (e.g. a `not_found` typed-search case, a `selectResult` click → confirm_pending case) — do NOT lower the gate.

- [ ] **Step 2: Mark T049a done in tasks.md**

In `specs/009-product-search-and-barcode-lookup/tasks.md`, flip the T049a checkbox to `[X]` and append an as-built note describing: the new `CatalogueSalePane` container; wiring (a) (typed→`search`, scan→`lookupBarcode`, response→FSM map); wiring (b) (eager `cart.create` via `creatingRef` de-dupe, `onLineAdded` register-callback threaded through `CartWorkspace`); the `productSearch` fail-closed flag; and that fixture-seeding for a live happy-path demo remains a deferred prerequisite for T050/T056.

- [ ] **Step 3: Commit tasks.md**

```bash
git add specs/009-product-search-and-barcode-lookup/tasks.md
git commit -m "docs(009): mark T049a done (live catalogue wiring) with as-built notes"
```

- [ ] **Step 4: Push + open PR**

```bash
git push -u origin feat/009-s5-t049a-live-wiring
```
Open a PR (base `main`) titled `feat(009): catalogue live wiring — search-exec + screen composition + cart lifecycle (T049a)`. Body: summarize wiring (a)+(b), the `productSearch` flag, the empty-catalogue caveat (seeding deferred), and the test plan (full suite + coverage green; typecheck/lint/codegen clean). End with the Claude Code attribution line.

---

## Self-Review notes (author)

- **Spec coverage:** flag (Task 1) ✓ · wiring (a) search-exec (Task 2) ✓ · wiring (b) eager-create + onLineAdded thread (Task 3) ✓ · Cart-workspace mount + `cart && productSearch` gating (Task 4) ✓ · empty-catalogue seeding explicitly deferred ✓.
- **Type consistency:** `CatalogueSalePane` props (`cartId?`, `onLineAdded`, `catalogueBridge?`, `cartBridge?`); `AddedLineResult` imported from `CartPane`; FSM setter names match `catalogueSearchStore` (`resolveResults`/`resolveSingleMatch`/`resolveAmbiguous`/`resolveCatalogueUnavailable`/`resolveNotFound`/`selectResult`/`clear`); `onLineAdded` register-callback shape on CartPane vs actual `(res)=>void` on the controller is bridged by `CartWorkspace` (the ref capture).
- **Caveats verified before relying on them:** confirm the `hydrateSignedIn` arg shape (Task 4 Step 1 note) and whether `react-router-dom`'s `MemoryRouter` is the project's router import (check an existing route test). Adjust to match the codebase if they differ.

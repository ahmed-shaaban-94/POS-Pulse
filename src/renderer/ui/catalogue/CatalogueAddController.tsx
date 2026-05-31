import { useState, type JSX } from 'react';

import type { CartBridgeAPI, PreloadBridgeAPI } from '../../../shared/bridge-api.js';
import type { AddedLineResult } from '../cart/CartPane.js';
import { useCatalogueSearchStore } from '../../stores/catalogueSearchStore.js';
import { ProductConfirmPanel } from './ProductConfirmPanel.js';

/**
 * 009 Slice S4b (T044/T045) — confirm-first add controller.
 *
 * The orchestration seam between the catalogue search FSM, 005's cart bridge,
 * and CartPane's line list. It renders `ProductConfirmPanel` ONLY while the FSM
 * is in `confirm_pending`; `ProductConfirmPanel` stays purely presentational.
 *
 * Add flow (FR-5 / FR-19 / FR-20 / FR-22):
 *   - On Add → call 005's `cart.lines.add` (the ONLY cart-mutation path, FR-20)
 *     with `item_ref = product.product_id`, quantity 1 (confirm-first, FR-5).
 *   - On bridge `ok` → forward the result to CartPane's `addLine` (the
 *     `onLineAdded` contract) and clear the FSM to idle for the next item. The
 *     cart freezes its OWN line snapshot at add-time (005 FR-011/013); 009 never
 *     writes cart state directly.
 *   - On `refused` → stay in `confirm_pending`, show a GENERIC block (no reason
 *     leaks, FR-19), and add nothing (no partial line, FR-22).
 *   - On Cancel → clear the FSM to idle; no bridge call.
 *
 * SECURITY: the renderer sends only `{ cart_id, item_ref, quantity }`; the
 * main-process resolver re-reads name/price authoritatively (S4a). No
 * credentials cross the bridge; the refusal copy carries no detail.
 *
 * The `bridge` prop mirrors CartPane's `_testBridge` seam (tests inject a
 * scripted bridge; production reads `window.api.cart`). Decoupled from S4a's
 * resolver — the controller only depends on the wire contract.
 */

export interface CatalogueAddControllerProps {
  /** The active cart to add into. Provided by the screen that owns the lifecycle (T049a). */
  cartId: string;
  /**
   * Called after a successful `cart.lines.add` with the bridge-confirmed line
   * result — CartPane registers its `addLine` here via `onLineAdded`. The single
   * cart-line-list write path (no parallel mutation, FR-20).
   */
  onLineAdded: (res: AddedLineResult) => void;
  /** Test-only bridge injection (mirrors CartPane `_testBridge`). MUST NOT be used in production. */
  bridge?: CartBridgeAPI;
  /** Confirm-add quantity. Always 1 for confirm-first (FR-5); a prop only for testability. */
  quantity?: number;
}

const GENERIC_ADD_ERROR = 'تعذّرت الإضافة — حاول مرة أخرى (could not add — try again)';

/* v8 ignore start — only reachable in Electron; jsdom never sets window.api (tests inject `bridge`) */
function readCartBridge(): CartBridgeAPI {
  const api = (window as unknown as { api?: PreloadBridgeAPI }).api;
  if (!api) {
    throw new Error('CatalogueAddController: window.api missing — preload bridge not initialised.');
  }
  return api.cart;
}
/* v8 ignore stop */

export function CatalogueAddController({
  cartId,
  onLineAdded,
  bridge,
  quantity = 1,
}: CatalogueAddControllerProps): JSX.Element | null {
  const state = useCatalogueSearchStore((s) => s.state);
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  if (state.kind !== 'confirm_pending') return null;

  const product = state.product;

  function getBridge(): CartBridgeAPI {
    /* v8 ignore next — readCartBridge() arm only reachable in Electron; tests inject `bridge` */
    return bridge ?? readCartBridge();
  }

  async function handleAdd(): Promise<void> {
    if (adding) return; // guard against a double-tap re-entrancy
    setAdding(true);
    setAddError(null);
    try {
      const res = await getBridge().lines.add({
        cart_id: cartId,
        item_ref: product.product_id,
        quantity,
        idempotency_key: crypto.randomUUID(),
      });
      if (res.kind === 'ok') {
        // 005's confirmed line snapshot → CartPane's list (the only write path).
        onLineAdded({
          line_id: res.line_id,
          display_name: res.display_name,
          unit_price_minor: res.unit_price_minor,
          line_subtotal_minor: res.line_subtotal_minor,
          quantity: res.quantity,
          version: res.version,
          merged: res.merged,
        });
        // Clear 009's search state for the next item (FSM owns no cart state).
        useCatalogueSearchStore.getState().confirmAdd();
      } else {
        // Generic, non-leaking block (FR-19). Stay in confirm_pending — no partial
        // line was created (FR-22); the cashier can retry or cancel.
        setAddError(GENERIC_ADD_ERROR);
      }
    } catch {
      // A thrown/rejected bridge call (IPC transport error) is a resolution
      // failure to the cashier — same generic, non-leaking block as a refusal
      // (FR-19). No detail surfaces; stay in confirm_pending so a retry works.
      setAddError(GENERIC_ADD_ERROR);
    } finally {
      // ALWAYS release the in-flight guard — on success, refusal, AND rejection.
      // The controller instance persists across confirm_pending cycles, so
      // leaving `adding` true would dead-lock every future add.
      setAdding(false);
    }
  }

  function handleCancel(): void {
    setAddError(null);
    useCatalogueSearchStore.getState().cancelConfirm();
  }

  return (
    <>
      <ProductConfirmPanel
        product={product}
        onAdd={() => {
          void handleAdd();
        }}
        onCancel={handleCancel}
      />
      {addError !== null && (
        <p className="catalogue-confirm__error" role="alert">
          {addError}
        </p>
      )}
    </>
  );
}

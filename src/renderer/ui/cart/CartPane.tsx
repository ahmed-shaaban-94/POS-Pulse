/**
 * 005-sales-cart T027 (S1 shell) + T052 (S2 live line list) — Cart pane.
 *
 * Layout: three-region vertical stack per S0 contact sheet §"Layout strategy":
 *   - Header strip (pane label).
 *   - Scrollable body (EmptyCartPlaceholder or live line list).
 *   - Footer strip (Σ subtotal, hand-off button — disabled for S2).
 *
 * Visibility rules:
 *   - Pane is rendered only when an operator session is signed in.
 *   - When signed out, the component returns null (no cart-shaped region
 *     leaked to unauthenticated screens).
 *
 * Live line list (T052):
 *   - CartPane maintains a local `lines` state array (with per-line `version`)
 *     to hold bridge-confirmed line display snapshots. The Zustand cartStore
 *     tracks only FSM state and cart_id.
 *   - Lines are added via the `onLineAdded` register-callback prop: the caller
 *     (item scan / product search surface) receives a `addLine` function and
 *     calls it after a successful `cart.lines.add` bridge response. CartPane
 *     appends a new row (merged=false) or updates subtotal+version (merged=true).
 *   - For tests, `_testInitialLines` seeds the list without any bridge call.
 *   - Bridge calls for update/remove/setNote use a typed defensive accessor
 *     identical to the PairedScreen / PairingForm pattern.
 *   - The renderer-side role gate here is a UX defence; main-process
 *     `requireOperatorSession` is the load-bearing trust boundary (AD-1).
 *
 * SECURITY:
 *   - Renderer never receives JWT, device_token, PIN, or credentials.
 *   - Note content is displayed as-is (display only); no logging (NFR-006).
 */

import { useState, useEffect, useCallback, type JSX } from 'react';

import type { CartBridgeAPI, PreloadBridgeAPI } from '../../../shared/bridge-api.js';
import { EmptyCartPlaceholder } from './EmptyCartPlaceholder.js';
import { LineItemRow } from './LineItemRow.js';
import { LineNotePopover } from './LineNotePopover.js';
import { useOperatorSessionStore } from '../../stores/operator-session-store.js';
import { useCartStore } from '../../stores/cart-store.js';
import { CartState } from '../../../shared/cart/cart-state.js';

export interface CartLineItem {
  lineId: string;
  displayName: string;
  quantity: number;
  unitPriceMinor: number;
  lineSubtotalMinor: number;
  note: string | null;
  /** Bridge-confirmed version token — required for update/remove/setNote. */
  version: number;
}

/** Shape of a confirmed add-line result passed to onLineAdded. */
export interface AddedLineResult {
  line_id: string;
  display_name: string;
  unit_price_minor: number;
  line_subtotal_minor: number;
  quantity: number;
  version: number;
  merged: boolean;
}

export interface CartPaneProps {
  /**
   * Test-only: seeds the initial line list without a bridge call.
   * Production wiring supplies lines via the bridge add-line flow.
   * This prop is not part of the public API and MUST NOT be used in production.
   */
  _testInitialLines?: CartLineItem[];
  /**
   * Test-only: injects the cart bridge instead of reading window.api.
   * MUST NOT be used in production.
   */
  _testBridge?: CartBridgeAPI;
  /**
   * Registers a callback that the caller must invoke after a successful
   * cart.lines.add bridge call. CartPane updates its local line list
   * (append for merged=false, update subtotal+version for merged=true).
   *
   * Registration is idempotent-overwrite: if onLineAdded identity changes,
   * the latest handleAddLine reference is re-registered. Wrap with useCallback
   * in the caller to avoid re-registration churn; omitting it is safe but wasteful.
   */
  onLineAdded?: (addLine: (res: AddedLineResult) => void) => void;
}

function formatMinorUnits(minor: number): string {
  const whole = Math.floor(minor / 100);
  const frac = Math.abs(minor % 100)
    .toString()
    .padStart(2, '0');
  return `¤${String(whole)}.${frac}`;
}

function readCartBridge(): CartBridgeAPI {
  const api = (window as unknown as { api?: PreloadBridgeAPI }).api;
  /* v8 ignore next 3 — only reachable in Electron; jsdom never sets window.api */
  if (!api) {
    throw new Error('CartPane: window.api missing — preload bridge not initialised.');
  }
  return api.cart;
}

export function CartPane({
  _testInitialLines,
  _testBridge,
  onLineAdded,
}: CartPaneProps = {}): JSX.Element | null {
  const sessionKind = useOperatorSessionStore((s) => s.state.kind);
  const activeCart = useCartStore((s) => s.activeCart);
  const [lines, setLines] = useState<CartLineItem[]>(_testInitialLines ?? []);
  const [noteOpenLineId, setNoteOpenLineId] = useState<string | null>(null);
  const [noteError, setNoteError] = useState<string | null>(null);

  const handleAddLine = useCallback((res: AddedLineResult): void => {
    setLines((prev) => {
      if (res.merged) {
        return prev.map((l) =>
          l.lineId !== res.line_id
            ? l
            : {
                ...l,
                quantity: res.quantity,
                lineSubtotalMinor: res.line_subtotal_minor,
                version: res.version,
              },
        );
      }
      return [
        ...prev,
        {
          lineId: res.line_id,
          displayName: res.display_name,
          quantity: res.quantity,
          unitPriceMinor: res.unit_price_minor,
          lineSubtotalMinor: res.line_subtotal_minor,
          note: null,
          version: res.version,
        },
      ];
    });
  }, []); // stable: only closes over setLines (React-guaranteed identity-stable)

  useEffect(() => {
    if (onLineAdded === undefined) return;
    onLineAdded(handleAddLine);
  }, [onLineAdded, handleAddLine]);

  if (sessionKind !== 'signedIn') {
    return null;
  }

  const showEmpty = activeCart === null || activeCart.state === CartState.empty;

  const cartSubtotalMinor = lines.reduce((acc, l) => acc + l.lineSubtotalMinor, 0);

  function getBridge(): CartBridgeAPI {
    return _testBridge ?? readCartBridge();
  }

  async function handleRemoveLine(lineId: string, version: number): Promise<void> {
    if (activeCart === null) return;
    const res = await getBridge().lines.remove({
      cart_id: activeCart.cart_id,
      line_id: lineId,
      version,
      idempotency_key: crypto.randomUUID(),
    });
    if (res.kind === 'ok') {
      setLines((prev) => prev.filter((l) => l.lineId !== lineId));
    }
  }

  async function handleIncrementLine(lineId: string, version: number): Promise<void> {
    if (activeCart === null) return;
    const res = await getBridge().lines.update({
      cart_id: activeCart.cart_id,
      line_id: lineId,
      op: 'increment',
      version,
      idempotency_key: crypto.randomUUID(),
    });
    if (res.kind === 'ok') {
      setLines((prev) =>
        prev.map((l) => {
          if (l.lineId !== lineId) return l;
          const newQty = l.quantity + 1;
          return {
            ...l,
            quantity: newQty,
            lineSubtotalMinor: newQty * l.unitPriceMinor,
            version: res.version,
          };
        }),
      );
    }
  }

  async function handleDecrementLine(lineId: string, version: number): Promise<void> {
    if (activeCart === null) return;
    const res = await getBridge().lines.update({
      cart_id: activeCart.cart_id,
      line_id: lineId,
      op: 'decrement',
      version,
      idempotency_key: crypto.randomUUID(),
    });
    if (res.kind === 'ok') {
      setLines((prev) => {
        const line = prev.find((l) => l.lineId === lineId);
        /* v8 ignore next — race guard: line removed before async response resolves */
        if (line === undefined) return prev;
        if (line.quantity <= 1) {
          return prev.filter((l) => l.lineId !== lineId);
        }
        const newQty = line.quantity - 1;
        return prev.map((l) =>
          l.lineId !== lineId
            ? l
            : {
                ...l,
                quantity: newQty,
                lineSubtotalMinor: newQty * l.unitPriceMinor,
                version: res.version,
              },
        );
      });
    }
  }

  async function handleSaveNote(
    lineId: string,
    version: number,
    note: string | null,
  ): Promise<void> {
    if (activeCart === null) return;
    setNoteError(null);
    const res = await getBridge().lines.setNote({
      cart_id: activeCart.cart_id,
      line_id: lineId,
      note,
      version,
      idempotency_key: crypto.randomUUID(),
    });
    if (res.kind === 'ok') {
      setLines((prev) =>
        prev.map((l) => (l.lineId !== lineId ? l : { ...l, note, version: res.version })),
      );
      setNoteOpenLineId(null);
    } else {
      setNoteError('Note rejected');
    }
  }

  return (
    <section className="cart-pane" data-testid="cart-pane" aria-label="Cart">
      <header className="cart-pane__header">
        <h2 className="cart-pane__title">Cart</h2>
      </header>
      <div className="cart-pane__body">
        {showEmpty ? (
          <EmptyCartPlaceholder />
        ) : (
          <ol className="cart-pane__line-list" aria-label="Cart items">
            {lines.map((line) => (
              <li key={line.lineId}>
                <LineItemRow
                  lineId={line.lineId}
                  displayName={line.displayName}
                  quantity={line.quantity}
                  unitPriceMinor={line.unitPriceMinor}
                  lineSubtotalMinor={line.lineSubtotalMinor}
                  note={line.note}
                  hasNote={line.note !== null}
                  onQuantityIncrement={() => {
                    void handleIncrementLine(line.lineId, line.version);
                  }}
                  onQuantityDecrement={() => {
                    void handleDecrementLine(line.lineId, line.version);
                  }}
                  onRemove={() => {
                    void handleRemoveLine(line.lineId, line.version);
                  }}
                  onNoteOpen={() => {
                    setNoteError(null);
                    setNoteOpenLineId(line.lineId);
                  }}
                />
                {noteOpenLineId === line.lineId && (
                  <LineNotePopover
                    open={true}
                    currentNote={line.note}
                    error={noteError}
                    onSave={(note) => {
                      void handleSaveNote(line.lineId, line.version, note);
                    }}
                    onClose={() => {
                      setNoteError(null);
                      setNoteOpenLineId(null);
                    }}
                  />
                )}
              </li>
            ))}
          </ol>
        )}
      </div>
      <footer className="cart-pane__footer">
        <div className="cart-pane__subtotal">
          <span className="cart-pane__subtotal-label">Subtotal</span>
          {showEmpty ? (
            <span className="cart-pane__subtotal-value" aria-label="subtotal placeholder">
              —
            </span>
          ) : (
            <span
              className="cart-pane__subtotal-value mono"
              data-testid="cart-subtotal-value"
              aria-label="cart subtotal"
            >
              {formatMinorUnits(cartSubtotalMinor)}
            </span>
          )}
        </div>
        <button
          type="button"
          className="cart-pane__handoff"
          disabled
          aria-disabled="true"
          data-testid="cart-handoff-button"
        >
          Hand off to payment
        </button>
      </footer>
    </section>
  );
}

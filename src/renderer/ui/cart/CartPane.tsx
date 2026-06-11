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
import type { PaymentIntentEnvelope } from '../../../shared/cart/handoff-envelope.js';
import { EmptyCartPlaceholder } from './EmptyCartPlaceholder.js';
import { LineItemRow } from './LineItemRow.js';
import { LineNotePopover } from './LineNotePopover.js';
import { VoidConfirmation } from './VoidConfirmation.js';
import { DiscountPlaceholderRow } from './DiscountPlaceholderRow.js';
import { HandoffSummary } from './HandoffSummary.js';
import { useOperatorSessionStore } from '../../stores/operator-session-store.js';
import { useCartStore } from '../../stores/cart-store.js';
import { useFeatureFlagsStore } from '../../stores/feature-flags-store.js';
import { usePaymentStore } from '../../stores/payment-store.js';
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

/**
 * Test-only seed shape for discount placeholders.
 *
 * `lineId` mirrors the `PaymentIntentEnvelope.discount_placeholders[].line_id`
 * field. When present, the placeholder renders inside the matching line's
 * row so the cashier sees it inline with that line (contact-sheet Surface 2).
 * When omitted (or null), the placeholder renders as an orphan row at the
 * tail of the same line list — still within the cart-line flow, never as a
 * separate section.
 */
export interface DiscountPlaceholderSeed {
  placeholderId: string;
  attribution_operator_id: string | null;
  lineId?: string | null;
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
   * Test-only: seeds discount placeholder rows without a bridge call.
   * MUST NOT be used in production.
   */
  _testDiscountPlaceholders?: DiscountPlaceholderSeed[];
  /**
   * Test-only: seeds the envelope for pre-frozen cart state.
   * MUST NOT be used in production.
   */
  _testInitialEnvelope?: PaymentIntentEnvelope;
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
  _testDiscountPlaceholders,
  _testInitialEnvelope,
  onLineAdded,
}: CartPaneProps = {}): JSX.Element | null {
  const sessionState = useOperatorSessionStore((s) => s.state);
  const sessionKind = sessionState.kind;
  const sessionRole = sessionState.kind === 'signedIn' ? sessionState.session.role : null;
  const activeCart = useCartStore((s) => s.activeCart);
  const cartStore = useCartStore();
  const paymentsFlag = useFeatureFlagsStore((s) => s.payments);
  const [lines, setLines] = useState<CartLineItem[]>(_testInitialLines ?? []);
  const [discountPlaceholders, setDiscountPlaceholders] = useState<DiscountPlaceholderSeed[]>(
    _testDiscountPlaceholders ?? [],
  );
  const [noteOpenLineId, setNoteOpenLineId] = useState<string | null>(null);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [voidDialogOpen, setVoidDialogOpen] = useState(false);
  const [envelope, setEnvelope] = useState<PaymentIntentEnvelope | null>(
    _testInitialEnvelope ?? null,
  );
  const [handoffError, setHandoffError] = useState<string | null>(null);

  const handleAddLine = useCallback((res: AddedLineResult): void => {
    // Advance the cart FSM on every confirmed add (005 owns this transition;
    // 009's add controller never writes cart state). The FIRST line moves the
    // cart empty → editing; subsequent adds just refresh lastLineId while
    // already editing. CartPane gates its line list, subtotal, and handoff
    // button on activeCart.state (showEmpty / canHandoff), so without this the
    // confirmed line lands in `lines` but stays invisible. Read the action via
    // getState() so the callback closes over nothing render-time and its []
    // deps stay valid.
    useCartStore.getState().applyLineAdded(res.line_id);
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
  }, []); // stable: closes only over setLines + useCartStore.getState (both identity-stable)

  useEffect(() => {
    if (onLineAdded === undefined) return;
    onLineAdded(handleAddLine);
  }, [onLineAdded, handleAddLine]);

  if (sessionKind !== 'signedIn') {
    return null;
  }

  const showEmpty = activeCart === null || activeCart.state === CartState.empty;

  const isFrozen = activeCart?.state === CartState.frozen_handed_off;
  const isHandingOff = activeCart?.state === CartState.handing_off;
  const isCancelled = activeCart?.state === CartState.cancelled;
  // Void hidden in empty/cancelled states (contact-sheet Surfaces 1, cancelled).
  // Post-handoff Void is manager/admin only and renders inside HandoffSummary
  // footer (Surface 8) whenever the envelope is hydrated. If the cart is
  // frozen but the envelope has not yet hydrated (rare pre-render edge case),
  // the header retains Void as a degraded fallback so the manager/admin
  // affordance is never lost.
  const canVoid =
    activeCart !== null &&
    activeCart.state !== CartState.empty &&
    activeCart.state !== CartState.cancelled &&
    (!isFrozen || sessionRole === 'manager' || sessionRole === 'admin');
  const handoffHostsVoid = isFrozen && envelope !== null;
  const showVoidInHeader = canVoid && !handoffHostsVoid;
  const showVoidInHandoff = canVoid && handoffHostsVoid;
  const canHandoff =
    activeCart !== null && activeCart.state === CartState.editing && lines.length > 0;
  const showHandoffButton = !isFrozen && !isCancelled;

  async function handleHandoff(): Promise<void> {
    /* v8 ignore next — defensive guard: button only renders when activeCart exists */
    if (activeCart === null) return;
    const cartId = activeCart.cart_id;
    const lastLineId = activeCart.lastLineId;
    setHandoffError(null);
    cartStore.applyHandoffStarted();
    const res = await getBridge().handoff({
      cart_id: cartId,
      per_line_versions: lines.map((l) => ({ line_id: l.lineId, version: l.version })),
      idempotency_key: crypto.randomUUID(),
    });
    if (res.kind === 'ok') {
      cartStore.applyFrozen();
      setEnvelope(res.envelope);
    } else {
      // handing_off → editing is a valid FSM transition (rollback path)
      useCartStore.setState({
        activeCart: { cart_id: cartId, state: CartState.editing, lastLineId },
      });
      // Generic error copy — no IDs or refusal details exposed to renderer
      setHandoffError('Could not hand off. Please try again.');
    }
  }

  async function handleVoidConfirm(): Promise<void> {
    /* v8 ignore next — defensive guard: button only renders when activeCart exists */
    if (activeCart === null) return;
    const res = await getBridge().void({
      cart_id: activeCart.cart_id,
      idempotency_key: crypto.randomUUID(),
    });
    if (res.kind === 'ok') {
      cartStore.applyCancelled();
      setVoidDialogOpen(false);
    }
  }

  async function handleRemoveDiscount(placeholderId: string): Promise<void> {
    /* v8 ignore next — defensive guard */
    if (activeCart === null) return;
    const res = await getBridge().discountPlaceholders.remove({
      cart_id: activeCart.cart_id,
      placeholder_id: placeholderId,
      idempotency_key: crypto.randomUUID(),
    });
    if (res.kind === 'ok') {
      setDiscountPlaceholders((prev) => prev.filter((d) => d.placeholderId !== placeholderId));
    }
  }

  const cartSubtotalMinor = lines.reduce((acc, l) => acc + l.lineSubtotalMinor, 0);

  // Group discount placeholders by their associated line for inline rendering
  // (contact-sheet Surface 2 / Surface 7). A placeholder is rendered inline
  // only when its `lineId` matches an existing line in the current cart;
  // stale, removed, null, or undefined `lineId` values fall through to
  // `orphanDiscounts` so the placeholder remains visible at the tail of the
  // same line list rather than disappearing silently if a line is removed
  // while a discount referencing it is in flight.
  const existingLineIds = new Set(lines.map((l) => l.lineId));
  const discountsByLine = new Map<string, DiscountPlaceholderSeed[]>();
  const orphanDiscounts: DiscountPlaceholderSeed[] = [];
  for (const dp of discountPlaceholders) {
    if (dp.lineId !== undefined && dp.lineId !== null && existingLineIds.has(dp.lineId)) {
      const list = discountsByLine.get(dp.lineId) ?? [];
      list.push(dp);
      discountsByLine.set(dp.lineId, list);
    } else {
      orphanDiscounts.push(dp);
    }
  }

  function getBridge(): CartBridgeAPI {
    /* v8 ignore next — readCartBridge() arm only reachable in Electron; tests always supply _testBridge */
    return _testBridge ?? readCartBridge();
  }

  async function handleRemoveLine(lineId: string, version: number): Promise<void> {
    /* v8 ignore next — defensive guard: buttons only render when activeCart exists */
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
    /* v8 ignore next — defensive guard: buttons only render when activeCart exists */
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
    /* v8 ignore next — defensive guard: buttons only render when activeCart exists */
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
    /* v8 ignore next — defensive guard: popover only renders when activeCart exists */
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
      {voidDialogOpen && (
        <VoidConfirmation
          onConfirm={() => {
            void handleVoidConfirm();
          }}
          onCancel={() => {
            setVoidDialogOpen(false);
          }}
        />
      )}
      <header className="cart-pane__header">
        <h2 className="cart-pane__title">Cart</h2>
        {showVoidInHeader && (
          <button
            type="button"
            className="cart-pane__void"
            data-testid="cart-void-button"
            data-variant="danger"
            onClick={() => {
              setVoidDialogOpen(true);
            }}
          >
            Void
          </button>
        )}
      </header>
      {isFrozen && envelope !== null ? (
        <div className="cart-pane__frozen-body">
          {showVoidInHandoff ? (
            <HandoffSummary
              envelope={envelope}
              showVoid={true}
              onVoidRequest={() => {
                setVoidDialogOpen(true);
              }}
              {...(paymentsFlag
                ? {
                    onContinue: () => {
                      usePaymentStore.getState().mount(envelope);
                    },
                  }
                : {})}
            />
          ) : (
            <HandoffSummary
              envelope={envelope}
              {...(paymentsFlag
                ? {
                    onContinue: () => {
                      usePaymentStore.getState().mount(envelope);
                    },
                  }
                : {})}
            />
          )}
        </div>
      ) : (
        <>
          <div className="cart-pane__body">
            {showEmpty ? (
              <EmptyCartPlaceholder />
            ) : (
              <ol className="cart-pane__line-list" aria-label="Cart items">
                {lines.map((line) => {
                  const lineDiscounts = discountsByLine.get(line.lineId) ?? [];
                  return (
                    <li key={line.lineId} className="cart-pane__line-list-item">
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
                      {lineDiscounts.map((dp) => (
                        <DiscountPlaceholderRow
                          key={dp.placeholderId}
                          placeholderId={dp.placeholderId}
                          onRemove={() => {
                            void handleRemoveDiscount(dp.placeholderId);
                          }}
                        />
                      ))}
                    </li>
                  );
                })}
                {orphanDiscounts.map((dp) => (
                  <li key={dp.placeholderId} className="cart-pane__line-list-item">
                    <DiscountPlaceholderRow
                      placeholderId={dp.placeholderId}
                      onRemove={() => {
                        void handleRemoveDiscount(dp.placeholderId);
                      }}
                    />
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
            {handoffError !== null && (
              <p className="cart-pane__handoff-error" data-testid="cart-handoff-error" role="alert">
                {handoffError}
              </p>
            )}
            {showHandoffButton && (
              <button
                type="button"
                className="cart-pane__handoff"
                disabled={!canHandoff || isHandingOff}
                aria-disabled={!canHandoff || isHandingOff ? 'true' : undefined}
                data-testid="cart-handoff-button"
                onClick={() => {
                  void handleHandoff();
                }}
              >
                {isHandingOff ? 'Handing off…' : 'Hand off to payment'}
              </button>
            )}
          </footer>
        </>
      )}
    </section>
  );
}

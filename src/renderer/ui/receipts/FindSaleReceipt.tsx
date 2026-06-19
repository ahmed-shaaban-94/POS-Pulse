import { useState, type JSX } from 'react';

import type { ReceiptsBridgeAPI, SalesBridgeAPI, SaleSummary } from '../../../shared/bridge-api.js';
import type { SaleNumber } from '../../../shared/sales/types.js';
import { ReprintAffordance } from './ReprintAffordance.js';
import { ReceiptPreview } from './ReceiptPreview.js';

/**
 * T451 — `<FindSaleReceipt>` (008 Slice 5; POS v3.5 Phase 5 — receipt preview).
 *
 * The receipt-affordance host surface: a minimal find-sale-by-number lookup
 * that renders a finalized sale's summary and mounts `<ReprintAffordance>` in
 * its slot. This is the integration point T451 calls for — the fuller
 * sale-search / recent-sale UI is 005's territory; this touches only the slot.
 *
 * Data: `sales.findByNumber` (read-only, tenant-scoped server-side). The reprint
 * affordance's visibility is gated (AD-10) on whether the sale's
 * `latest_print_event` succeeded — a sale that never printed cannot be
 * reprinted, so the affordance is absent.
 *
 * POS v3.5 Phase 5 (renderer-only): a "Preview receipt" control mounts the
 * already-built `<ReceiptPreview>` for the looked-up sale, improving operator
 * visibility. The preview reads `receipts.preview` (read-only, no side effects)
 * — this component issues NO new bridge call of its own; the printed-output
 * path (`src/main/receipts`) is untouched.
 */

export interface FindSaleReceiptProps {
  /** Injected for tests; production falls back to `window.api.sales`. */
  _testSalesBridge?: SalesBridgeAPI;
  /** Forwarded to <ReprintAffordance>; production falls back to window.api.receipts. */
  _testReceiptsBridge?: ReceiptsBridgeAPI;
}

function resolveSalesBridge(injected?: SalesBridgeAPI): SalesBridgeAPI | null {
  if (injected !== undefined) return injected;
  const api = (window as unknown as { api?: { sales?: SalesBridgeAPI } }).api;
  return api?.sales ?? null;
}

type LookupState =
  | { phase: 'idle' }
  | { phase: 'searching' }
  | { phase: 'found'; sale: SaleSummary }
  | { phase: 'not_found' };

function hasSuccessfulPrint(sale: SaleSummary): boolean {
  return sale.latest_print_event?.outcome === 'success';
}

export function FindSaleReceipt({
  _testSalesBridge,
  _testReceiptsBridge,
}: FindSaleReceiptProps): JSX.Element {
  const [query, setQuery] = useState('');
  const [state, setState] = useState<LookupState>({ phase: 'idle' });
  // Phase 5: whether the read-only receipt preview is open for the found sale.
  const [previewing, setPreviewing] = useState(false);

  async function handleFind(): Promise<void> {
    const trimmed = query.trim();
    if (trimmed === '') return; // no empty lookups
    const salesApi = resolveSalesBridge(_testSalesBridge);
    if (salesApi === null) return;
    setPreviewing(false); // a new lookup closes any open preview
    setState({ phase: 'searching' });
    try {
      const res = await salesApi.findByNumber({ sale_number: trimmed as SaleNumber });
      setState(res.kind === 'ok' ? { phase: 'found', sale: res.sale } : { phase: 'not_found' });
    } catch {
      setState({ phase: 'not_found' });
    }
  }

  return (
    <section aria-label="Find sale receipt" className="flex flex-col gap-4">
      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void handleFind();
        }}
      >
        <label className="flex flex-col gap-1 text-sm">
          <span>Sale number</span>
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
            }}
            className="min-h-11 rounded-md border border-border px-3 py-2"
          />
        </label>
        <button
          type="submit"
          className="min-h-11 min-w-11 rounded-md border border-border px-4 py-2 text-sm font-medium"
          disabled={state.phase === 'searching'}
        >
          {state.phase === 'searching' ? 'Finding…' : 'Find sale'}
        </button>
      </form>

      {state.phase === 'not_found' ? (
        <p role="status" className="text-sm text-amber-700">
          Sale not found.
        </p>
      ) : null}

      {state.phase === 'found' ? (
        <div className="flex flex-col gap-2 rounded-md border border-border p-4">
          <p className="font-medium">{state.sale.sale_number}</p>
          <p className="text-sm text-muted-foreground">
            {state.sale.selling_operator_display_name} · {state.sale.terminal_label}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              // 44×44 touch floor (FR-068); native button ⟹ keyboard-operable.
              className="min-h-11 min-w-11 rounded-md border border-border px-4 py-2 text-sm font-medium"
              onClick={() => {
                setPreviewing(true);
              }}
            >
              Preview receipt
            </button>
            <ReprintAffordance
              sale={{
                sale_id: state.sale.sale_id,
                has_successful_print: hasSuccessfulPrint(state.sale),
              }}
              // Conditional spread: exactOptionalPropertyTypes rejects passing
              // an explicit `undefined` to an optional prop.
              {...(_testReceiptsBridge !== undefined ? { _testReceiptsBridge } : {})}
            />
          </div>
          {previewing ? (
            <ReceiptPreview
              saleId={state.sale.sale_id}
              onClose={() => {
                setPreviewing(false);
              }}
              // ReceiptPreview reads `receipts.preview` itself; forward the
              // injected test bridge so unit renders use the double, not
              // window.api. Conditional spread per exactOptionalPropertyTypes.
              {...(_testReceiptsBridge !== undefined ? { _testBridge: _testReceiptsBridge } : {})}
            />
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

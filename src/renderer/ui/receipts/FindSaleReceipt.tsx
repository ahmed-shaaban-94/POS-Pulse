import { useState, type JSX } from 'react';

import type { ReceiptsBridgeAPI, SalesBridgeAPI, SaleSummary } from '../../../shared/bridge-api.js';
import type { SaleNumber } from '../../../shared/sales/types.js';
import { ReprintAffordance } from './ReprintAffordance.js';

/**
 * T451 — `<FindSaleReceipt>` (008 Slice 5).
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

  async function handleFind(): Promise<void> {
    const trimmed = query.trim();
    if (trimmed === '') return; // no empty lookups
    const salesApi = resolveSalesBridge(_testSalesBridge);
    if (salesApi === null) return;
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
      ) : null}
    </section>
  );
}

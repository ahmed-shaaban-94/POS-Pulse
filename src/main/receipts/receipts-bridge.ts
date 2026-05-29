/**
 * T170 — `receipts.preview` bridge handler (008 Slice 2).
 *
 * The renderer-facing entry for the read-only receipt preview. Gates on an
 * active session, reads the Sale (tenant/branch/terminal-scoped), derives the
 * canonical `ReceiptPayload` (T164), renders the AD-6 engine's HTML (T160), and
 * returns it plus layout metadata for the preview pane.
 *
 * Strictly read-only (contracts/bridge-api.md §"receipts.preview" Notes):
 *   • emits no print command, kicks no drawer, mutates no Sale;
 *   • cross-tenant misses refuse with `sale_not_found` (no information leak,
 *     §A4 #6) — same posture as `sales.read`;
 *   • a defensive forbidden-field-in-request guard runs FIRST (§A4 #2).
 */

import { FORBIDDEN_PAYLOAD_KEYS } from '../../shared/audit/forbidden-keys.js';
import type { SalesRepository, SaleRow } from '../sales/repositories/sales.repository.js';
import type { PrintEventsRepository } from '../sales/repositories/print-events.repository.js';
import type { OperatorSessionForSales } from '../sales/sales-bridge.js';
import type {
  ReceiptsBridgeAPI,
  ReceiptsPreviewRequest,
  ReceiptsPreviewResponse,
  ReceiptsRetryPrintRequest,
  ReceiptsRetryPrintResponse,
} from '../../shared/bridge-api.js';
import { deriveReceiptPayload } from './receipts-payload.js';
import { renderReceipt } from './template-engine.js';
import type { PrintDispatcher, PrintDispatchContext } from './print-dispatcher.js';
import type { DrawerKickDispatcher } from '../drawer/drawer-kick.js';

/** 80 mm Font A column width — the v1 printed-slip dimension (§(a) layout). */
const PREVIEW_WIDTH_CHARS = 42;

// ── Forbidden-field-in-request scan (mirrors sales-bridge) ──────────────────

const RECEIPTS_BRIDGE_FORBIDDEN_KEYS = new Set<string>([
  'pan',
  'cvv',
  'cvc',
  'track',
  'track1',
  'track2',
  'cardholder',
  'cardholder_name',
  'expiry',
  'auth_payload',
  'cryptogram',
  'voucher_code',
  'voucher_balance',
  'voucher_redemption_intent_token',
  'authority_payload',
  'envelope_payload',
  'raw_envelope',
  'issuer_name',
  'pin_record_id',
]);

function findForbiddenKey(node: unknown, seen: WeakSet<object> = new WeakSet()): string | null {
  if (node === null || typeof node !== 'object') return null;
  if (seen.has(node)) return null;
  seen.add(node);
  if (Array.isArray(node)) {
    for (const item of node) {
      const hit = findForbiddenKey(item, seen);
      if (hit !== null) return hit;
    }
    return null;
  }
  for (const key of Object.keys(node)) {
    if ((FORBIDDEN_PAYLOAD_KEYS as readonly string[]).includes(key)) return key;
    if (RECEIPTS_BRIDGE_FORBIDDEN_KEYS.has(key)) return key;
    const hit = findForbiddenKey((node as Record<string, unknown>)[key], seen);
    if (hit !== null) return hit;
  }
  return null;
}

export type ReceiptsBridge = ReceiptsBridgeAPI;

export interface ReceiptsBridgeDependencies {
  getCurrentSession: () => OperatorSessionForSales | null;
  /** Read-only: preview never writes. `insert` is in the Pick only to share
   *  the repository type; it is never called. */
  salesRepo: Pick<SalesRepository, 'readById' | 'insert'>;
  /** S3 retryPrint: read prior failed print_events to build the lineage. */
  printEventsRepo: Pick<PrintEventsRepository, 'readBySale'>;
  /** S3 retryPrint: re-runs the print pipeline + writes the retry row. */
  printDispatcher: Pick<PrintDispatcher, 'dispatchRetryPrint'>;
  /**
   * S4 (optional): chains the drawer-kick after a retry that SUCCEEDS. Per
   * FR-052, a retry-success IS the canonical first print, so it runs the same
   * drawer gating a first-print success would (cash-inclusive → kick). Absent
   * in Slice-3-era construction / tests; when absent, retry behaves exactly as
   * before. The dispatcher's `readBySale` guard keeps it idempotent — a sale
   * that already opened/suppressed its drawer is a no-op.
   */
  drawerKickDispatcher?: DrawerKickDispatcher;
}

/**
 * Tenant-isolation gate shared by the mutating handlers: returns the scoped
 * Sale row, or a refusal reason. A cross-scope or missing row refuses as
 * `sale_not_found` (no existence-distinguishing leak; §A4 #6).
 */
type ScopedSale =
  | { ok: true; row: SaleRow; session: OperatorSessionForSales }
  | { ok: false; reason: 'no_session' | 'sale_not_found' };

export function createReceiptsBridge(deps: ReceiptsBridgeDependencies): ReceiptsBridge {
  const { getCurrentSession, salesRepo, printEventsRepo, printDispatcher, drawerKickDispatcher } =
    deps;

  function scopedSale(sale_id: string): ScopedSale {
    const session = getCurrentSession();
    if (session === null) return { ok: false, reason: 'no_session' };
    const row = salesRepo.readById(sale_id);
    if (
      row === null ||
      row.tenant_id !== session.tenant_id ||
      row.branch_id !== session.branch_id ||
      row.terminal_id !== session.terminal_id
    ) {
      return { ok: false, reason: 'sale_not_found' };
    }
    return { ok: true, row, session };
  }

  return {
    async preview(req: ReceiptsPreviewRequest): Promise<ReceiptsPreviewResponse> {
      // §A4 #2 — forbidden-field guard first, before any session/DB work.
      const forbidden = findForbiddenKey(req);
      if (forbidden !== null) {
        return await Promise.resolve({ kind: 'refused', reason: 'forbidden_field_in_request' });
      }

      const session = getCurrentSession();
      if (session === null) {
        return await Promise.resolve({ kind: 'refused', reason: 'no_session' });
      }

      const row = salesRepo.readById(req.sale_id);
      if (row === null) {
        return await Promise.resolve({ kind: 'refused', reason: 'sale_not_found' });
      }
      // Tenant isolation — a cross-scope hit refuses as sale_not_found (no
      // existence-distinguishing leak; §A4 #6).
      if (
        row.tenant_id !== session.tenant_id ||
        row.branch_id !== session.branch_id ||
        row.terminal_id !== session.terminal_id
      ) {
        return await Promise.resolve({ kind: 'refused', reason: 'sale_not_found' });
      }

      // S2: preview always renders the `preview` variant (byte-equal to
      // first_print content per AD-6). The reprint_duplicate preview lands with
      // the reprint flow in Slice 5.
      //
      // A corrupt persisted JSON column (engine-written, so unreachable in
      // practice) throws a typed derivation error; we map it to sale_not_found
      // so the renderer shows the preview error state rather than the IPC call
      // rejecting with an unstructured failure.
      let html: string;
      try {
        const payload = deriveReceiptPayload(row, { variant: 'preview' });
        html = renderReceipt(payload).html;
      } catch {
        return await Promise.resolve({ kind: 'refused', reason: 'sale_not_found' });
      }

      return await Promise.resolve({
        kind: 'ok',
        preview: {
          html,
          width_chars: PREVIEW_WIDTH_CHARS,
          bilingual_locale: 'ar-EG-RTL-with-latin-en',
        },
      });
    },

    async retryPrint(req: ReceiptsRetryPrintRequest): Promise<ReceiptsRetryPrintResponse> {
      // §A4 #2 — forbidden-field guard first.
      const forbidden = findForbiddenKey(req);
      if (forbidden !== null) {
        return { kind: 'refused', reason: 'forbidden_field_in_request' };
      }

      const scoped = scopedSale(req.sale_id);
      if (!scoped.ok) {
        return { kind: 'refused', reason: scoped.reason };
      }
      const { row, session } = scoped;

      // FR-052: a retry that succeeds is the canonical FIRST print — render the
      // `first_print` variant (no duplicate-copy marker). The reprint variant
      // is Slice 5's `receipts.reprint`, a different handler.
      let payload;
      try {
        payload = deriveReceiptPayload(row, { variant: 'first_print' });
      } catch {
        // A corrupt persisted JSON column (engine-written, unreachable in
        // practice) maps to sale_not_found rather than rejecting the IPC call.
        return { kind: 'refused', reason: 'sale_not_found' };
      }

      // Idempotency / FR-052 double-print guard (Path A — key-on-state, Ahmed
      // 2026-05-29). A sale that ALREADY has a successful or manual_override
      // print must NOT print again — a re-fired retry is a no-op that returns
      // the original success outcome. This keys idempotency on durable print
      // state rather than a client token (print_events has no idempotency_key
      // column; migrations 0020-0027 are sign-off-frozen). The contract's
      // payload-mismatch arm is unreachable for a sale-scoped key.
      const priorEvents = printEventsRepo.readBySale(req.sale_id);
      const alreadyPrinted = priorEvents.find(
        (e) => e.outcome === 'success' || e.outcome === 'manual_override',
      );
      if (alreadyPrinted !== undefined) {
        return {
          kind: 'ok',
          outcome: 'success',
          print_event_id: alreadyPrinted.print_event_id,
          purpose: 'retry_after_failure',
          render_path: alreadyPrinted.render_path ?? 'escpos_direct',
          printed_at: alreadyPrinted.printed_at,
        };
      }

      // Lineage: the ids of the prior FAILED print events for this sale, so the
      // retry row records what it superseded (FR-052 audit trail).
      const previousFailedPrintEventIds = priorEvents
        .filter((e) => e.outcome === 'failure')
        .map((e) => e.print_event_id);

      const ctx: PrintDispatchContext = {
        sale_id: row.sale_id,
        tenant_id: row.tenant_id,
        branch_id: row.branch_id,
        terminal_id: row.terminal_id,
        // Attribution is the CURRENT signed-in operator (the retrying operator),
        // not the selling operator on the Sale row (FR-024).
        session_id: session.operator_session_id,
        attribution_operator_id: session.operator_id,
      };

      // An INFRA throw inside the dispatcher (render/INSERT/emit bug — not a
      // printer fault) must NOT reject the IPC call with an unstructured error.
      // Degrade to sale_not_found (the generic refusal); the Sale is durable
      // and the renderer's banner stays raised for another retry.
      let dispatched;
      try {
        dispatched = await printDispatcher.dispatchRetryPrint(
          payload,
          ctx,
          previousFailedPrintEventIds,
        );
      } catch {
        return { kind: 'refused', reason: 'sale_not_found' };
      }
      const { result, print_event_id, printed_at } = dispatched;

      if (result.ok) {
        // FR-052 / Slice 4: a retry that succeeds IS the canonical first print,
        // so it runs drawer gating exactly like an auto-fired first print
        // (cash-inclusive → kick). The drawer dispatch is a sibling step — its
        // own faults never reject this handler (the dispatcher resolves void on
        // internal faults; the Sale + print are already durable). The
        // `readBySale` guard makes a re-fired retry idempotent.
        //
        // Attribution is the RETRYING operator (FR-052 retry semantics +
        // FR-022/FR-023 operator attribution), mirroring this handler's print
        // ctx above — NOT FR-024 (which governs reprint attribution). Deliberate
        // asymmetry: an auto-fired first-print drawer event attributes to the
        // SELLING operator (dispatch-first-print-on-finalize → row.selling_operator_id),
        // while a retry-success drawer event for the same logical first print
        // attributes to the operator who clicked Retry. Both are "the operator
        // who caused this drawer kick" — the intended attribution.
        if (drawerKickDispatcher !== undefined) {
          try {
            await drawerKickDispatcher.dispatchOnFirstPrintSuccess({
              sale_id: row.sale_id,
              tenant_id: row.tenant_id,
              branch_id: row.branch_id,
              terminal_id: row.terminal_id,
              session_id: session.operator_session_id,
              attribution_operator_id: session.operator_id,
              tender_lines_summary_json: row.tender_lines_summary_json,
              triggering_print_event_id: print_event_id,
            });
          } catch {
            // Defence-in-depth: dispatcher resolves void by contract, but a
            // buggy drawer dispatch must not turn a successful print into a
            // refused retry. The print already succeeded + is durable.
          }
        }
        return {
          kind: 'ok',
          outcome: 'success',
          print_event_id,
          purpose: 'retry_after_failure',
          render_path: result.render_path,
          printed_at,
        };
      }
      // Still-failed: attempt accepted, print failed → ok+failure (NOT refused).
      return {
        kind: 'ok',
        outcome: 'failure',
        print_event_id,
        purpose: 'retry_after_failure',
        failure_reason: result.failure_reason,
      };
    },
  };
}

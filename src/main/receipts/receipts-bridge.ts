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
import type { SalesRepository } from '../sales/repositories/sales.repository.js';
import type { OperatorSessionForSales } from '../sales/sales-bridge.js';
import type {
  ReceiptsBridgeAPI,
  ReceiptsPreviewRequest,
  ReceiptsPreviewResponse,
} from '../../shared/bridge-api.js';
import { deriveReceiptPayload } from './receipts-payload.js';
import { renderReceipt } from './template-engine.js';

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
}

export function createReceiptsBridge(deps: ReceiptsBridgeDependencies): ReceiptsBridge {
  const { getCurrentSession, salesRepo } = deps;

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
  };
}

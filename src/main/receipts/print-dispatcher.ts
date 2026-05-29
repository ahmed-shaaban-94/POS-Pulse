/**
 * T240 / T241 / T242 — print dispatcher (008 Slice 3).
 *
 * Ties the pure print pipeline (render + path-select + dispatch) to durable
 * state: on each print attempt it INSERTs a `print_events` row and emits the
 * matching audit event. Keeping this orchestration OUT of `print-pipeline.ts`
 * leaves path selection unit-testable in isolation (T210-T212) and confines
 * all DB/audit side-effects to one place.
 *
 * Durability invariant (T241 / US1 scenario 8): the print is NOT part of the
 * AD-2 atomic transaction. A print failure writes a failure `print_events` row
 * + a `sale.receipt.print_failed` audit event and returns `{ ok:false }`, but
 * NEVER touches the Sale row and NEVER throws — the caller (finalize-listener)
 * keeps the Sale durable and the renderer raises the persistent banner.
 *
 * Redaction (T242 / FR-071 / AD-9): the rendered slip (HTML + ESC/POS bytes)
 * stays inside the pipeline. The audit + log payloads carry ONLY structural
 * fields (sale_id / render_path / print_event_id / failure_reason) — never the
 * item names or any slip content. This is a by-VALUE guarantee, distinct from
 * the audit emitter's key-name scan.
 */

import type { PrintPipeline, PrintPipelineResult } from './print-pipeline.js';
import type {
  PrintEventsRepository,
  PrintEventRow,
} from '../sales/repositories/print-events.repository.js';
import type { SaleAuditEmitter } from '../sales/audit-emitter.js';
import type { ReceiptPayload } from '../../shared/receipts/types.js';

/**
 * Structural logger port — only the levels the dispatcher uses. Injected so
 * tests can capture every arg by value (T242). Matches the pino `Logger`
 * method shape so the production logger satisfies it directly.
 */
export interface PrintDispatchLogger {
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
}

/**
 * The non-sensitive context the dispatcher needs to attribute the print event
 * and audit row. Sourced from the finalized Sale + the AD-2 listener seam
 * (already-derived `attribution_operator_id`, per the audit-emitter contract).
 */
export interface PrintDispatchContext {
  sale_id: string;
  tenant_id: string;
  branch_id: string;
  terminal_id: string;
  session_id: string | null;
  attribution_operator_id: string;
}

export interface PrintDispatcherDependencies {
  pipeline: PrintPipeline;
  printEventsRepo: PrintEventsRepository;
  auditEmitter: SaleAuditEmitter;
  /** Injected clock — ISO-8601 UTC string. */
  now(): string;
  /** Injected id generator for the print_events PK. */
  newPrintEventId(): string;
  /** Optional structural logger; defaults to a no-op. Never receives slip content. */
  logger?: PrintDispatchLogger;
}

export interface PrintDispatcher {
  /**
   * Dispatch a first-print attempt for a freshly-finalized sale. Always
   * resolves (never throws): success → success row + `sale.receipt.printed`;
   * failure → failure row + `sale.receipt.print_failed`. Returns the pipeline
   * result so the caller can decide banner state.
   */
  dispatchFirstPrint(
    payload: ReceiptPayload,
    ctx: PrintDispatchContext,
  ): Promise<PrintPipelineResult>;
}

const NOOP_LOGGER: PrintDispatchLogger = {
  info: () => {},
  warn: () => {},
};

export function createPrintDispatcher(deps: PrintDispatcherDependencies): PrintDispatcher {
  const { pipeline, printEventsRepo, auditEmitter } = deps;
  const logger = deps.logger ?? NOOP_LOGGER;
  // `now` / `newPrintEventId` are called via `deps.` below (not destructured)
  // to preserve any `this` binding the caller may rely on (unbound-method).
  const now = (): string => deps.now();

  function baseRow(
    ctx: PrintDispatchContext,
    print_event_id: string,
  ): Omit<PrintEventRow, 'outcome' | 'render_path' | 'failure_reason'> {
    return {
      print_event_id,
      sale_id: ctx.sale_id,
      purpose: 'first_print',
      acting_operator_id: ctx.attribution_operator_id,
      acting_operator_session_id: ctx.session_id ?? '',
      duplicate_copy_sequence_number: null,
      previous_failed_print_event_ids: null,
      printed_at: now(),
    };
  }

  return {
    async dispatchFirstPrint(
      payload: ReceiptPayload,
      ctx: PrintDispatchContext,
    ): Promise<PrintPipelineResult> {
      const result = await pipeline.render(payload);
      const print_event_id = deps.newPrintEventId();
      const created_at = now();

      if (result.ok) {
        printEventsRepo.insert({
          ...baseRow(ctx, print_event_id),
          outcome: 'success',
          render_path: result.render_path,
          failure_reason: null,
        });
        auditEmitter.emitRaw({
          action_category: 'sale.receipt.printed',
          attribution_operator_id: ctx.attribution_operator_id,
          tenant_id: ctx.tenant_id,
          branch_id: ctx.branch_id,
          originating_terminal_id: ctx.terminal_id,
          session_id: ctx.session_id,
          created_at,
          // Structural ONLY — no slip content (T242).
          payload: {
            sale_id: ctx.sale_id,
            print_event_id,
            render_path: result.render_path,
          },
        });
        // Structural log line ONLY — never the rendered payload (T242).
        logger.info({ msg: 'receipt.printed', sale_id: ctx.sale_id, print_event_id });
        return result;
      }

      printEventsRepo.insert({
        ...baseRow(ctx, print_event_id),
        outcome: 'failure',
        // A failed print still chose a path — the print_events CHECK requires
        // render_path on failure rows too (only manual_override is null).
        render_path: result.render_path,
        failure_reason: result.failure_reason,
      });
      auditEmitter.emitRaw({
        action_category: 'sale.receipt.print_failed',
        attribution_operator_id: ctx.attribution_operator_id,
        tenant_id: ctx.tenant_id,
        branch_id: ctx.branch_id,
        originating_terminal_id: ctx.terminal_id,
        session_id: ctx.session_id,
        created_at,
        payload: {
          sale_id: ctx.sale_id,
          print_event_id,
          failure_reason: result.failure_reason,
        },
      });
      logger.warn({
        msg: 'receipt.print_failed',
        sale_id: ctx.sale_id,
        print_event_id,
        failure_reason: result.failure_reason,
      });
      return result;
    },
  };
}

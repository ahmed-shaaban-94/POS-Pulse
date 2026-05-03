import type { PairingSubmitResult } from '../../shared/pairing-types.js';
import type { PairingStore } from './store.js';
import { TransportError, type Network, type PairResult } from './network.js';
import { mapFailure } from './failure-mapping.js';

/**
 * 002-terminal-pairing T023 + T023a + T041 — `PairingService.submit`.
 *
 * The orchestrator. Composes:
 *
 *   network.pair(code)          // transport-only rejection
 *     -> on ok=true:   pairingStore.persist({...})  -> success log
 *     -> on ok=false:  mapFailure -> typed PairingSubmitResult
 *                      (US3 wires the three recoverable failure
 *                       outcomes; US4/US5 extend this list later)
 *     -> on TransportError:                        -> network_error log
 *                      (timed_out propagates to log)
 *
 * Bridge contract LOCKED FROM MVP (T023a): submit() resolves for every
 * backend/network outcome with a typed `PairingSubmitResult`. The only
 * rejection path is programmer error (non-string code). US3/US4/US5/US7
 * later refine outcome categories without ever changing this rule.
 *
 * T041 (US3) — failure path = log only. The three new outcomes
 * (invalid_code / expired_code / already_paired) NEVER call
 * `pairingStore.persist()` or `pairingStore.clear()`. Prior persisted
 * state (token + assignment row) is byte-for-byte unchanged across a
 * failed submit (FR-8).
 *
 * Security policy (Constitution VII + spec NFR-4 / FR-9 / FR-10):
 *   - The `pairing_code` is read from the argument and passed to the
 *     network module ONLY. It is never placed in any log payload, any
 *     error message, or any retained closure.
 *   - The `device_token` is read from the network success body and
 *     handed directly to `pairingStore.persist()`; it is never logged
 *     or returned through the bridge (the success result type omits
 *     the token by design).
 *   - The pairingLog emitter is schema-restricted (US6 will tighten
 *     it further); US2 ships a thin wrapper around the base pino
 *     logger that the redaction list (PR #15) already scrubs.
 *   - Exactly one log record per call, regardless of outcome.
 */

/**
 * In-memory shape the schema-restricted pairing logger accepts.
 * Mirrors `data-model.md § PairingAttemptLogRecord`. US6 will land a
 * runtime guard; US2 enforces the shape via TypeScript.
 */
export interface PairingAttemptLogRecord {
  event: 'pairing_attempt';
  outcome:
    | 'success'
    | 'invalid_code'
    | 'expired_code'
    | 'already_paired'
    | 'branch_mismatch'
    | 'rate_limited'
    | 'network_error'
    | 'unknown_error';
  /** ISO-8601, second precision. */
  at: string;
  /** Present only when outcome === 'success'. Opaque server-issued ID. Never the device token. */
  terminal_id?: string;
  /** Present only when outcome === 'rate_limited' (US5; not emitted by US2). */
  retry_after_s?: number;
  /** Present only when outcome === 'network_error' AND the cause was the 30s timeout. */
  timed_out?: boolean;
}

export interface PairingService {
  submit(pairing_code: string): Promise<PairingSubmitResult>;
}

export interface CreatePairingServiceOptions {
  store: PairingStore;
  network: Network;
  /**
   * Schema-restricted log emitter. The service NEVER calls a generic
   * logger.info() or logger.error() — every emission goes through this
   * function, which validates the record shape via TypeScript today
   * and via runtime guard in US6.
   */
  pairingLog: (record: PairingAttemptLogRecord) => void;
  /** Provides `new Date()` for testability of the `at` field. */
  clock: () => Date;
}

export function createPairingService(deps: CreatePairingServiceOptions): PairingService {
  const { store, network, pairingLog, clock } = deps;

  function nowIso(): string {
    return clock().toISOString();
  }
  function pairedAtSeconds(): number {
    return Math.floor(clock().getTime() / 1000);
  }

  return {
    async submit(pairing_code: string): Promise<PairingSubmitResult> {
      // Programmer error guard. The IPC handler will repeat this check
      // (T024+); here we defend against in-process callers that bypass
      // IPC. Rejection is the documented "only" path.
      if (typeof pairing_code !== 'string') {
        throw new TypeError('PairingService.submit: pairing_code must be a string.');
      }

      let pairResult: PairResult;
      try {
        pairResult = await network.pair(pairing_code);
      } catch (err) {
        // T023a — split network rejections by type:
        //   - TransportError (DNS/TLS/refused/abort/30s timeout) is the
        //     documented "no clean network" path -> outcome='network_error'.
        //     If the TransportError carries timed_out: true, the log
        //     record carries it too.
        //   - Anything ELSE that escaped from network.pair() is a bug
        //     in the network module or one of its deps (the contract
        //     says network.pair() rejects ONLY with TransportError).
        //     We catch defensively and resolve as 'unknown_error' so
        //     the bridge contract — "submit() never rejects for any
        //     backend/network outcome" — holds even if a future
        //     contributor breaks the network module's contract.
        if (err instanceof TransportError) {
          const record: PairingAttemptLogRecord = err.timed_out
            ? { event: 'pairing_attempt', outcome: 'network_error', at: nowIso(), timed_out: true }
            : { event: 'pairing_attempt', outcome: 'network_error', at: nowIso() };
          pairingLog(record);
          return { outcome: 'network_error' };
        }
        pairingLog({ event: 'pairing_attempt', outcome: 'unknown_error', at: nowIso() });
        return { outcome: 'unknown_error' };
      }

      if (pairResult.ok) {
        // Success path. Persist atomically through the store; a SQL
        // failure inside persist() is compensated by deleting the
        // SecretStore entry (PR #16 contract). If persist itself
        // throws (storage failure beyond the store's compensation),
        // we catch and route to unknown_error so the bridge contract
        // holds.
        try {
          await store.persist({
            device_token: pairResult.body.device_token,
            tenant_id: pairResult.body.tenant_id,
            branch_id: pairResult.body.branch_id,
            terminal_id: pairResult.body.terminal_id,
            terminal_label: pairResult.body.terminal_label,
            paired_at: pairedAtSeconds(),
          });
        } catch {
          // Storage error after a successful network call. The store
          // already rolled back the SecretStore (PR #16). We emit one
          // log record with unknown_error and resolve — the bridge
          // contract is preserved.
          pairingLog({ event: 'pairing_attempt', outcome: 'unknown_error', at: nowIso() });
          return { outcome: 'unknown_error' };
        }

        pairingLog({
          event: 'pairing_attempt',
          outcome: 'success',
          at: nowIso(),
          terminal_id: pairResult.body.terminal_id,
        });

        // The success result type explicitly OMITS device_token — that
        // is the renderer-visible shape, and the only place the token
        // ever has to live is the SecretStore.
        return {
          outcome: 'success',
          tenant_id: pairResult.body.tenant_id,
          branch_id: pairResult.body.branch_id,
          terminal_id: pairResult.body.terminal_id,
          terminal_label: pairResult.body.terminal_label,
        };
      }

      // Reachable non-2xx. US3 wires the three documented recoverable
      // outcomes (invalid_code / expired_code / already_paired); US4
      // (branch_mismatch) and US5 (rate_limited) extend this list. Any
      // outcome the switch does not yet recognise (or that mapFailure
      // returns from a future code path the service hasn't wired) falls
      // through to 'unknown_error' so the bridge contract holds.
      //
      // No store call on any branch — failure path = log only (FR-8).
      // Prior persisted token + assignment row remain byte-for-byte
      // untouched across every failure outcome.
      const outcome = mapFailure(pairResult.status, pairResult.body);
      switch (outcome) {
        case 'invalid_code':
        case 'expired_code':
        case 'already_paired': {
          pairingLog({ event: 'pairing_attempt', outcome, at: nowIso() });
          return { outcome };
        }
        // US4 will add 'branch_mismatch'; US5 will add 'rate_limited'
        // (with retry_after_s). Until then, those outcome categories
        // cannot reach this switch — mapFailure routes them through the
        // catch-all 'unknown_error' default.
        default: {
          pairingLog({ event: 'pairing_attempt', outcome: 'unknown_error', at: nowIso() });
          return { outcome: 'unknown_error' };
        }
      }
    },
  };
}

/**
 * 008 sale-sync flush — `SaleSyncFlushClient` interface (DI seam).
 *
 * Pushes one finalized sale to DP-2 `POST /api/pos/v1/sales` (captureSale,
 * Option-Y auth). The outcome mirrors the read-down client's transport union,
 * but the flush distinguishes a RETRYABLE failure (`no_connection` — transport
 * fault or 5xx; leave the row pending, back off) from a NON-RETRYABLE one
 * (`refused` — 4xx validation/auth; the sale will never succeed as-is, mark it
 * failed). DP-2 dedups on `(tenant, sourceSystem, externalId)`, so a re-flush
 * of an already-captured sale resolves to `ok` (201 fresh OR 200 replay) — both
 * are success.
 *
 * Credentials (Clerk JWT + device attestation) are attached main-process-side
 * and NEVER surfaced here or logged (mirrors read-down-client + AD-2).
 */
import type { CaptureSaleBody } from './build-capture-sale-body.js';

/** The sale was captured (201 fresh) or already present (200 idempotent replay). */
export interface SaleSyncFlushOk {
  kind: 'ok';
}

/** Reached but the request was REFUSED (4xx — validation/auth). Non-retryable. */
export interface SaleSyncFlushRefused {
  kind: 'refused';
}

/** Backend unreachable (transport fault) OR 5xx. Retryable — leave row pending. */
export interface SaleSyncFlushNoConnection {
  kind: 'no_connection';
}

export type SaleSyncFlushResult =
  | SaleSyncFlushOk
  | SaleSyncFlushRefused
  | SaleSyncFlushNoConnection;

/** Credentials + body for one captureSale call. The client never logs these. */
export interface SaleSyncFlushRequest {
  /** Fresh Clerk session JWT — `Authorization: Bearer <jwt>`. */
  readonly jwt: string;
  /** Paired-terminal device attestation — `X-Device-Attestation: <attestation>`. */
  readonly deviceAttestation: string;
  /** Stable per-sale idempotency key (the sale_id is a good choice). */
  readonly idempotencyKey: string;
  /** The captureSale request body (pure sale data; carries NO credential). */
  readonly body: CaptureSaleBody;
}

export interface SaleSyncFlushClient {
  /**
   * POST one sale to DP-2 captureSale. Resolves to a typed outcome; NEVER
   * rejects (transport faults map to `no_connection`). The credentials are
   * attached here main-process-side and never surfaced.
   */
  flushSale(req: SaleSyncFlushRequest): Promise<SaleSyncFlushResult>;
}

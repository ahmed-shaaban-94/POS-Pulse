/**
 * 004-operator-session T050 — Audit-event forbidden payload field names.
 *
 * Single source of truth for field names that MUST NEVER appear in any
 * audit-event payload tree (any nesting depth) per PR-1 / FR-027:
 * raw cardholder data, full PII, credential fragments, PIN values, Clerk
 * JWTs, session tokens, and device-token attestations.
 *
 * Three layers consume this list:
 *
 *   1. `src/main/audit/audit-emitter.ts` — refuses any payload that contains
 *      one of these names (load-bearing FR-027 / PR-1 enforcement at the
 *      bridge handler).
 *
 *   2. `src/main/logging/logger.ts` — extends the pino redaction path list
 *      so that any non-audit log line that happens to mention one of these
 *      keys gets scrubbed automatically (defence in depth — even if a
 *      future contributor logs a request/response object directly).
 *
 *   3. `src/main/observability/sentry-main.ts` and
 *      `src/renderer/observability/sentry-renderer.ts` — extend the
 *      `beforeSend` denylist so the same key names are stripped from
 *      Sentry events recursively at any nesting depth (defence in depth
 *      against `Sentry.setContext()` / `extra` containing nested payloads).
 *
 * Hoisted to `shared` so both main and renderer (via Sentry) reach one
 * canonical list — a future addition propagates to all three layers
 * automatically.
 *
 * MUST NOT shrink: the list is append-only. Adding a new sensitive key
 * here strictly tightens redaction guarantees across the application.
 */

export const FORBIDDEN_PAYLOAD_KEYS = [
  'pin',
  'pin_hash',
  'password',
  'password_hash',
  'clerk_jwt',
  'clerk_session_token',
  'device_token',
  'device_token_attestation',
  'pairing_code',
  'token',
  'secret',
  'credential',
] as const satisfies readonly string[];

export type ForbiddenPayloadKey = (typeof FORBIDDEN_PAYLOAD_KEYS)[number];

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
 *      `src/renderer/observability/sentry-renderer.ts` — strip Sentry-event
 *      keys via `isForbiddenSentryKey` (exact-key over this list ∪ the frozen
 *      curated substring supplement), recursively at any nesting depth
 *      (defence in depth against `Sentry.setContext()` / `extra` containing
 *      nested payloads). Both scrubbers derive from THIS file — no separate
 *      hand-maintained denylist (T522 closed the prior regex drift).
 *
 * Hoisted to `shared` so both main and renderer (via Sentry) reach one
 * canonical list — a future addition propagates to all three layers
 * automatically.
 *
 * MUST NOT shrink: the list is append-only. Adding a new sensitive key
 * here strictly tightens redaction guarantees across the application.
 */

export const FORBIDDEN_PAYLOAD_KEYS = [
  // — Credential / auth (002 + 004 pre-existing) —
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
  // — Credential / auth (008 AD-9 explicit names; data-model.md §Forbidden fields FR-072) —
  'jwt',
  'attestation',
  'pin_record_id',
  // — Card surface (FR-070) —
  'pan',
  'card_pan',
  'truncated_pan',
  'cvv',
  'track_data',
  'track1',
  'track2',
  'cardholder_name',
  'cardholder',
  'holder_name',
  'expiry',
  'expiration',
  'issuer_name',
  'auth_payload',
  'approval_code',
  'cryptogram',
  'terminal_receipt_text',
  'receipt_text',
  // — Voucher surface (FR-071) —
  'voucher_code',
  'voucher_balance',
  'voucher_holder',
  'voucher_holder_pii',
  'voucher_redemption_intent_token',
  'redemption_intent_token',
  'intent_token',
  'authority_payload',
  'authority_response',
  'raw_voucher_authority_response',
  // — Envelope (FR-074; only envelope_handoff_action_id is permitted) —
  'envelope_payload',
  'raw_envelope',
  'payment_intent_envelope',
] as const satisfies readonly string[];

export type ForbiddenPayloadKey = (typeof FORBIDDEN_PAYLOAD_KEYS)[number];

/**
 * T522 — curated substring terms for the Sentry scrubbers ONLY.
 *
 * Frozen to the exact term set the pre-T522 `DENYLIST_PATTERN` regex used, so
 * `isForbiddenSentryKey` is PURELY ADDITIVE to Sentry: every key the old regex
 * caught is still caught, plus the newly-named exact fields above. Do NOT add
 * broad new terms here (e.g. `authority`, `intent_token`) — substring breadth
 * over the full surface over-scrubs legitimate diagnostic/allowed keys (e.g.
 * the permitted, printed `voucher_authority_redemption_id` and the
 * `intent_token_*` reason codes). See the design doc §2 "Pre-existing
 * limitation".
 */
export const SUPPLEMENTAL_SENTRY_SUBSTRING_TERMS = [
  'secret',
  'token',
  'password',
  'credential',
  'card',
  'pii',
  'cvv',
  'pan',
  'email',
  'phone',
  'pin',
  'jwt',
  'clerk',
  'auth',
  'pair',
] as const satisfies readonly string[];

/**
 * Sentry-scrubber key matcher (defence-in-depth telemetry redaction).
 *
 * Returns true if `key` (case-insensitively) EXACTLY equals a
 * `FORBIDDEN_PAYLOAD_KEYS` entry, OR contains a
 * `SUPPLEMENTAL_SENTRY_SUBSTRING_TERMS` term as a substring.
 *
 * Sentry ONLY. The audit-emitter (`findForbiddenKey`) and pino
 * (`REDACTION_PATHS`) consume `FORBIDDEN_PAYLOAD_KEYS` directly with their own
 * EXACT-match semantics; they MUST NOT route through this helper (it adds
 * substring breadth they do not want).
 */
export function isForbiddenSentryKey(key: string): boolean {
  const lower = key.toLowerCase();
  for (const k of FORBIDDEN_PAYLOAD_KEYS) {
    if (lower === k.toLowerCase()) return true;
  }
  for (const term of SUPPLEMENTAL_SENTRY_SUBSTRING_TERMS) {
    if (lower.includes(term)) return true;
  }
  return false;
}

> **Optional reference template — not a mandatory gate.**
> Use only when it reduces risk or clarifies a non-trivial change.

# Redaction / Local Secrets Matrix: [Feature or PR]

## When to use

- Any change touching auth tokens, session state, device identity, or pairing
- Any change that passes data across the renderer/preload/main boundary
- Any change that writes to `pino` logs, Sentry (main or renderer), or SQLite
- Any audit payload, outbox event, or sync payload that leaves the local process
- Any change to `safeStorage` read/write paths

## When NOT to use

- UI-only renderer changes that handle no tokens or credentials
- Pure test refactors with no production code changes
- Migrations that add structural columns only (no secret-bearing fields)
- Documentation-only changes

---

## Sensitive value inventory

For each value, mark allowed storage/exposure locations. Anything not explicitly marked ✅ is PROHIBITED.

| Value | Source | SQLite | pino logs | Sentry (main) | Sentry (renderer) | Renderer | Notes |
|:--|:--|:--:|:--:|:--:|:--:|:--:|:--|
| Clerk JWT | Clerk OIDC session | ❌ | ❌ | ❌ | ❌ | ❌ | Never persisted or logged anywhere |
| Clerk session token | Clerk session | ❌ | ❌ | ❌ | ❌ | ❌ | In-memory main process only |
| `device_token` | `safeStorage` / pairing | ❌ | ❌ | ❌ | ❌ | ❌ | Stays in main; never crosses bridge |
| `device_token_attestation` | Constructed in main | ❌ | ❌ | ❌ | ❌ | ❌ | Used in outgoing HTTP headers only |
| `pairing_code` | Pairing flow | ❌ | ❌ | ❌ | ❌ | ❌ | Ephemeral; never persisted after pairing |
| `pin` (raw digit string) | Renderer input | ❌ | ❌ | ❌ | ❌ | transit only | Cleared from memory after hash |
| `pin_hash` (Argon2id) | Derived in main | ✅ (hashed only) | ❌ | ❌ | ❌ | ❌ | Stored as Argon2id hash; never raw |
| `password` (raw) | Login form | ❌ | ❌ | ❌ | ❌ | transit only | Cleared immediately after use |
| `password_hash` | Not applicable | — | — | — | — | — | POS-Pulse delegates password auth to Clerk |
| `token` / `secret` / `credential` (generic) | Varies | ❌ | ❌ | ❌ | ❌ | ❌ | Any field with these names is treated as secret |
| `safeStorage` payload | Electron `safeStorage` | — | ❌ | ❌ | ❌ | ❌ | OS-encrypted; never logged or bridged |
| Audit event payload | Generated in main | ✅ (redacted) | redacted | redacted | — | ❌ | Must pass through canonical redaction before any emission |
| Operator display name | Clerk profile | — | ✅ | ✅ | ✅ | ✅ | Not a secret; allowed in non-sensitive contexts |
| `tenantId` / `operatorId` / `deviceId` | Main enrichment | ✅ | ✅ | ✅ | — | ❌ | IDs are not secrets but MUST NOT be renderer-supplied |

---

## Redaction paths

| Surface | Mechanism | Forbidden keys list |
|:--|:--|:--|
| `pino` logger (main) | `redact` config in logger factory | `token`, `secret`, `password`, `pin`, `jwt`, `clerkToken`, `deviceToken`, `attestation`, `pairing_code`, `authorization` |
| Sentry (main) | `beforeSend` hook — recursive key scrub | Same set as pino; plus full `request.headers.authorization` |
| Sentry (renderer) | `beforeSend` hook — recursive key scrub | `token`, `secret`, `password`, `pin`; renderer has no access to JWT/device token so those are not a renderer-side risk |
| Audit event payload | `scrubAuditPayload()` / equivalent canonical function | Applied before `INSERT` into `audit_events` and before sync HTTP call |
| IPC response to renderer | Handler never includes secret fields in return value | No JWT, device token, PIN hash, or safeStorage content returned |

---

## Boundary checks

For this feature/PR, confirm each boundary:

- [ ] **Main → renderer (IPC response):** contains no Clerk JWT, device token, PIN hash, or safeStorage data
- [ ] **Renderer → main (IPC request):** main strips or ignores any token/credential fields renderer attempts to supply
- [ ] **Main → pino:** all log calls for this path pass through the configured `redact` list
- [ ] **Main → Sentry:** `beforeSend` hook is active and scrubs recursive keys
- [ ] **Main → SQLite `audit_events`:** payload has been through `scrubAuditPayload()` before `INSERT`
- [ ] **Main → sync HTTP (Data-Pulse-2):** `device_token_attestation` is in header only, not in body; body payload is redacted

---

## Test evidence

List tests that prove redaction or non-exposure for this PR:

| Claim | Test file | Test name / description |
|:--|:--|:--|
| No JWT in IPC response | | |
| No device token in IPC response | | |
| Forbidden key stripped from renderer payload | | |
| `scrubAuditPayload` removes forbidden keys recursively | | |
| PIN hash stored only as Argon2id; raw PIN not persisted | | |
| pino redacts `token` / `secret` fields | | |
| Sentry `beforeSend` strips sensitive keys | | |

---

## Notes

- [ ] No new field named `token`, `secret`, `credential`, `key`, `password`, or `pin` is added to any IPC response without explicit justification
- [ ] Any new audit payload field is reviewed against the canonical forbidden-keys list before shipping
- [ ] `safeStorage` read/write is confined to `src/main/` — no preload or renderer access

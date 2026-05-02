# Data Model: Terminal Pairing (002)

**Feature:** [./spec.md](./spec.md)
**Plan:** [./plan.md](./plan.md)

This feature persists exactly two pieces of state on the terminal: the **device token** (secret)
and the **terminal assignment** (configuration). One additional in-memory shape — the
**pairing-attempt log record** — is the only thing that touches observability.

---

## SecretStore — `device_token`

**Where:** Electron `safeStorage` via the `SecretStore` abstraction shipped in 001.
**Key:** `device_token` (single key; one terminal holds at most one token).
**Value:** Opaque UTF-8 string returned by the backend's pair response.
**Sensitivity:** SECRET. Never displayed in the UI, never logged, never transmitted anywhere except
back to the backend on subsequent (non-pairing) requests via the `X-Terminal-Token` header.
**Lifecycle:**
- *Written* exactly once per pairing ceremony, on a successful pair response.
- *Read* by future features (e.g., to set `X-Terminal-Token` on every backend call).
- *Cleared* by `pairingStore.clear()` only — never by a failed pair attempt (FR-8 / FR-14).
- *Unreadable* (DPAPI decryption failure, missing key) → `getStatus()` returns `invalid` and
  the operator is routed back to the Pairing screen (FR-1 c).

The constitution's production guard from 001 (refuse to start when
`safeStorage.isEncryptionAvailable() === false`) covers this feature unchanged.

---

## SQLite — `terminal_assignment`

**Migration:** `migrations/0003_terminal_assignment.sql`. Forward-only, transactional, recorded in
`schema_migrations`.

**Schema (canonical SQL):**

```sql
CREATE TABLE terminal_assignment (
  id              INTEGER PRIMARY KEY CHECK (id = 1),
  tenant_id       TEXT    NOT NULL,
  branch_id       TEXT    NOT NULL,
  terminal_id     TEXT    NOT NULL,
  terminal_label  TEXT    NOT NULL,
  paired_at       INTEGER NOT NULL          -- unix epoch seconds
);
```

**Constraints / invariants:**
- The `id = 1` `CHECK` enforces "at most one row" — a terminal belongs to exactly one
  `(tenant, branch, terminal)` tuple at a time.
- All four ID-bearing fields are stored as opaque strings; the terminal does not parse or validate
  their format.
- `paired_at` is unix epoch seconds for sorting and human display only; never used as an
  expiry or as part of authentication.
- Writes happen exclusively through `pairingStore.persist({...})` — no other module gets a SQL
  cursor for this table.

**Sensitivity:** Configuration. Not a secret on its own; not safe to display to a different user
account but not catastrophic if exfiltrated. Treated as ordinary local data.

**Lifecycle:**
- *Inserted* alongside the SecretStore write on a successful pair response, in the same
  transactional unit (the table write commits only after the SecretStore write returns).
- *Updated* never. A re-pair (admin-driven, per the clarification) deletes the row and writes a
  fresh one as part of the new ceremony.
- *Deleted* by `pairingStore.clear()` only.
- *Absent* (no row) → `getStatus()` returns `unpaired` regardless of what SecretStore reports;
  the renderer routes to `/pairing`.

**Status derivation logic** (`pairingStore.getStatus()`):

| `device_token` in SecretStore | `terminal_assignment` row | Result |
|:--|:--|:--|
| missing | absent | `unpaired` |
| present and decryptable | present | `paired` (with the row's fields) |
| present but **unreadable** (decryption fails) | any | `invalid` |
| missing | present (orphaned row) | `invalid` (and on next `clear()` the row is dropped) |
| present | absent (orphaned token) | `invalid` (and on next `clear()` the token is dropped) |

`invalid` is the explicit recovery state for FR-1 (c); the operator sees the Pairing screen with a
diagnostic banner.

---

## In-memory — `PairingAttemptLogRecord`

**Where:** Constructed inline by the pairing service on every submit attempt and emitted via the
existing `pino` logger from 001 with namespace `pairing`. **Never** persisted by this feature.

**Schema (TypeScript):**

```ts
type PairingAttemptLogRecord = {
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
  /** Present only when outcome === 'rate_limited'. Seconds the UI must keep submit disabled. */
  retry_after_s?: number;
};
```

**Invariants:**
- The record contains **no** `pairing_code`, **no** `device_token`, and **no** wrapped exception
  whose message could carry either. The pairing service constructs the record from a fixed schema;
  arbitrary objects are not allowed through this code path.
- The redaction list in the `pino` formatter still adds `pairing_code` and `device_token` as a
  belt-and-braces safeguard for any non-pairing log line that might mention them.
- Exactly one log record per submit attempt, regardless of how many internal retries the network
  layer performed (currently zero — `network.ts` does not retry).

---

## Out-of-band fields the terminal **does not** persist

This feature does not store, cache, or display the **`pairing_code`** itself. The code lives in
the `<input>` element's React state for the duration of a single submit and is dropped when the
form unmounts (success → navigate to `/paired`; failure → form is reset).

This feature does not store **`expires_at`** even if the backend returns one. Token expiry handling
(refresh, rotation, revocation) is out of scope per the spec; it lands as a separate feature once
backend rotation policy is finalized.

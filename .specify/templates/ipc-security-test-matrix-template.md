> **Optional reference template — not a mandatory gate.**
> Use only when it reduces risk or clarifies a non-trivial change.

# IPC Security Test Matrix: [Bridge Method / Channel]

## When to use

- Any new or modified preload bridge method (`src/preload/`)
- Any new or modified IPC handler (`src/main/`)
- Any new channel added to the `contextBridge` exposure in `src/shared/bridge-api.ts`
- Any change that alters what the renderer can send to, or receive from, the main process

## When NOT to use

- UI-only renderer changes with no IPC involvement
- Main-process-only refactors that do not touch handler input/output shape
- Test-only changes that do not add new IPC paths
- Documentation or config-only changes

---

## Bridge surface

| Field | Value |
|:--|:--|
| Bridge method | `operator.<methodName>` |
| IPC channel | `operator:<channel-name>` |
| Preload file | `src/preload/operator.ts` (or relevant preload file) |
| Main handler file | `src/main/ipc/<handler-file>.ts` |
| Bridge API type | `src/shared/bridge-api.ts` — `OperatorBridge.<method>` |

---

## Renderer → main: field trust classification

List every field the renderer can supply. For each, state whether the main process trusts it or enriches/replaces it.

| Field | Renderer supplies? | Main enriches / replaces? | Validation / notes |
|:--|:--:|:--:|:--|
| `<field1>` | ✅ | — | Validated as `<type>` before use |
| `<field2>` | — | ✅ | Sourced from `safeStorage` / device token / session store |
| `tenantId` | ❌ never | ✅ always | Main-only; renderer MUST NOT send this |
| `operatorId` | ❌ never | ✅ always | Main-only; renderer MUST NOT send this |
| `deviceId` | ❌ never | ✅ always | Main-only; renderer MUST NOT send this |

---

## Forbidden renderer-supplied fields

These fields MUST NOT be accepted from the renderer under any circumstance:

- `tenantId` / `tenant_id`
- `operatorId` / `operator_id`
- `deviceId` / `device_id`
- `clerkToken` / `clerk_token` / any Clerk JWT
- `sessionToken` / `session_token`
- `deviceToken` / `device_token`
- `deviceTokenAttestation` / `device_token_attestation`
- `authToken` / `token` / `secret` / `credential`

---

## Refusal and error behavior

| Scenario | Handler behavior | Renderer sees |
|:--|:--|:--|
| Missing required field | Returns `{ ok: false, error: 'invalid_request' }` | Generic refusal — no internal detail |
| Forbidden field present in payload | Field is stripped / handler rejects | Generic refusal — no leakage |
| Auth/session not active | Returns `{ ok: false, error: 'unauthorized' }` | Generic — no session detail |
| DB / internal error | Logs error server-side (main); returns generic error | No stack trace, no path |

---

## Security test assertions

Copy the applicable items into the relevant test file under `tests/`.

### Trust boundary

- [ ] Renderer cannot supply `tenantId`, `operatorId`, or `deviceId`; if supplied they are stripped or the call is rejected
- [ ] Renderer cannot supply any Clerk JWT or session token
- [ ] Renderer cannot supply `device_token` or `device_token_attestation`
- [ ] Main enriches all trusted identity fields independently of renderer input

### Payload validation

- [ ] Handler rejects payloads missing required fields with a generic error
- [ ] Handler rejects payloads with unexpected keys where strict validation is required
- [ ] Handler validates field types (string length, numeric range, enum membership as applicable)

### Return value

- [ ] Response contains no Clerk JWT, session token, device token, or safeStorage content
- [ ] Response contains no internal file paths or stack traces on error
- [ ] Error messages are generic (no internal state leaked)

### Logs / Sentry

- [ ] No Clerk JWT or device token appears in `pino` log output for this path
- [ ] No Clerk JWT or device token appears in Sentry breadcrumbs for this path
- [ ] PII fields (name, email, PIN) are not logged

---

## Test coverage checklist

| Scenario | Test file | Pass condition |
|:--|:--|:--|
| Happy path: valid renderer payload → success response | `tests/unit/<name>.test.ts` | Returns `{ ok: true, ... }` |
| Forbidden field stripped / rejected | `tests/unit/<name>.test.ts` | Returns generic error or field absent from handler context |
| Missing required field | `tests/unit/<name>.test.ts` | Returns `{ ok: false, error: 'invalid_request' }` |
| No JWT / device token in response | `tests/unit/<name>.test.ts` | Response object contains none of the forbidden keys |
| Main enriches trusted fields | `tests/integration/<name>.test.ts` | Handler uses own enriched values, ignores renderer-supplied equivalents |

---

## Notes

- [ ] `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` confirmed on the relevant `BrowserWindow`
- [ ] No `ipcRenderer.on` or `ipcRenderer.send` used directly in renderer — all calls go through the typed bridge
- [ ] Handler is registered in `src/main/` and is not exposed via a raw `ipcMain.on` without input validation

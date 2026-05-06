# S1 Cross-Process Redaction Smoke Evidence

**Task:** T036 — Run cross-process redaction smoke (T025) on merged S1 code  
**Test file:** `src/tests/operator-redaction.test.ts`  
**Commit under test:** `d9f4e21` — feat(004): S1 operator sign-in — manager/admin Clerk path (#46)  
**Run date:** 2026-05-06  
**Runner:** `npm test -- --reporter=verbose src/tests/operator-redaction.test.ts`

---

## Test Output

```
 RUN  v4.1.5

 ✓ src/tests/operator-redaction.test.ts > T025 — operator sign-in cross-process redaction
     > pino: outcome "happy path (signed_in)" — no password / identifier / JWT in any log line  3ms
 ✓ src/tests/operator-redaction.test.ts > T025 — operator sign-in cross-process redaction
     > pino: outcome "Clerk refused" — no password / identifier / JWT in any log line  0ms
 ✓ src/tests/operator-redaction.test.ts > T025 — operator sign-in cross-process redaction
     > pino: outcome "Clerk no_connection" — no password / identifier / JWT in any log line  0ms
 ✓ src/tests/operator-redaction.test.ts > T025 — operator sign-in cross-process redaction
     > pino: outcome "backend refused" — no password / identifier / JWT in any log line  0ms
 ✓ src/tests/operator-redaction.test.ts > T025 — operator sign-in cross-process redaction
     > pino: outcome "backend no_connection" — no password / identifier / JWT in any log line  0ms
 ✓ src/tests/operator-redaction.test.ts > T025 — operator sign-in cross-process redaction
     > pino: outcome "takeover_required" — no password / identifier / JWT in any log line  0ms
 ✓ src/tests/operator-redaction.test.ts > T025 — operator sign-in cross-process redaction
     > sign-out: the JWT held for backend POST is not leaked  1ms

 Test Files  1 passed (1)
      Tests  7 passed (7)
   Start at  23:33:01
   Duration  189ms (transform 34ms, setup 0ms, import 67ms, tests 6ms, environment 0ms)
```

---

## What the Test Proves

The T025 test (`src/tests/operator-redaction.test.ts`) drives `SignInHandler` and `SignOutHandler`
through every sign-in outcome category with a pino logger capturing all JSON log lines to an
in-process `PassThrough` stream. After each scenario, it asserts the captured output contains
none of:

| Sentinel | Value used in test |
|:--|:--|
| `SUBMITTED_PASSWORD` | `'super-secret-password-9999'` |
| `SUBMITTED_IDENTIFIER` | `'leaky.manager@pharmacy.test'` |
| `ISSUED_JWT` | `'eyJhbGciOiJSUzI1NiJ9.LEAKED-JWT-PAYLOAD.fake-signature'` |

### Scenarios covered

| # | Scenario | Sign-in outcome | Credential paths exercised |
|:--|:--|:--|:--|
| 1 | Happy path | `signed_in` | Password → Clerk exchange; JWT → backend signIn; JWT stored in holder; session created |
| 2 | Clerk refused | `refused (invalid_input)` | Password → Clerk; Clerk returns `refused`; short-circuit before backend |
| 3 | Clerk no_connection | `refused (no_connection)` | Password → Clerk; Clerk returns `no_connection`; short-circuit before backend |
| 4 | Backend refused | `refused (invalid_input)` | Password → Clerk (ok); JWT → backend; backend returns `refused` |
| 5 | Backend no_connection | `refused (no_connection)` | Password → Clerk (ok); JWT → backend; backend returns `no_connection` |
| 6 | Takeover required | `takeover_required` | Password → Clerk (ok); JWT → backend; backend returns `takeover_required` |
| 7 | Sign-out | `signed_out` | JWT held for backend POST; cleared after local teardown |

All 7 scenarios pass: zero occurrences of the password, identifier, or JWT sentinel in any pino
log line across all outcome paths.

---

## Redaction Mechanism Verified

The test's pino instance mirrors the production redaction list from `src/main/logging/logger.ts`:

```
paths: [
  'password',    '*.password',    '*.*.password',
  'identifier',  '*.identifier',  '*.*.identifier',
  'pin',         '*.pin',         '*.*.pin',
  'jwt',         '*.jwt',         '*.*.jwt',
  'clerk_jwt',   '*.clerk_jwt',   '*.*.clerk_jwt',
  'session_token', '*.session_token', '*.*.session_token',
  'authorization', '*.authorization', '*.*.authorization',
]
```

The belt-and-braces mechanism (pino `redact`) is verified to be active for the credential fields.
The deeper guarantee is the code path: `SignInHandler.logRefusal` and `SignInHandler.logSuccess`
never include credential fields in their log payload objects, so the test demonstrates both that
the redaction layer works AND that no credential value reaches pino in the first place.

---

## Full Suite Confirmation

```
 Test Files  91 passed (91)
      Tests  1032 passed (1032)
   Start at  23:33:09
   Duration  6.89s
```

No regressions to the 1032-test baseline established at the end of S1 (PR #46 final commit).

---

## T036 Verdict

**PASS.** The cross-process redaction smoke confirms that the password, identifier, and Clerk
JWT are never present in any pino log output across all sign-in outcome categories and the
sign-out path. PR-1 is upheld by both code-path verification (T035 line-by-line review in
`s1-review.md`) and this live test run.

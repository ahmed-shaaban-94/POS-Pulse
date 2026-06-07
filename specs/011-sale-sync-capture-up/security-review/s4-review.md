# §A4 P8 Bridge-Security Review — 011 `sales:syncStatus`

**Gate:** §A4 (P8 bridge-security). **Status:** self-assessed **PASS** (post-impl walk), fast-tracked
under owner "fire" authorization. **Reviewer:** implementer (Opus). **Date:** 2026-06-07.
**Constitution:** v1.5.1. Mirrors 010's `s4-review.md` control style.

## Scope

The single new renderer-facing channel `sales:syncStatus` and its bridge surface:
`src/main/ipc/sales-sync.ts`, `src/shared/sales-sync/channels.ts`, `src/preload/sales-sync.ts`,
`src/shared/bridge-api.ts` (`SalesSyncBridgeAPI`), `src/renderer/ui/sales-sync/SaleSyncStatus.tsx`.

## Control matrix

| # | Control | Verdict | Evidence |
|---|---------|---------|----------|
| WR-1 | Read-only — NO renderer-exposed write/trigger | **PASS** | Exactly one channel registered (`sales:syncStatus`); IPC test asserts `channels() === [SYNC_STATUS]`. The renderer cannot start/stop/mutate the drain (engine is main-process background). The `SaleSyncStatus` component renders no `<button>` (test asserts `querySelector('button')` is null). |
| INP-1 | Request scope never trusted | **PASS** | The handler ignores its request payload entirely; scope comes from the injected `readStatus` (resolved device principal main-side), never from the renderer. |
| SEC-1 | No token / secret crosses the bridge | **PASS** | The operator token is read in-process by the engine and never enters the status path; the response is `{ pending, deadLetter, lastSuccessAt }` only. IPC test asserts the serialized response contains no `token`/`bearer`/`operator` and exactly the 3 keys. |
| P7-1 | No PII / card / raw error in the response | **PASS** | Counts + one ISO timestamp only. No sale detail, no line items, no error body. |
| AD-1 | contextIsolation / sandbox preserved | **PASS** | Bridge added via the existing `contextBridge.exposeInMainWorld('api', …)` object; no new exposure mechanism, `nodeIntegration`/`sandbox` unchanged. |
| BOUND-1 | Renderer degrades, never crashes, on a lying boundary | **PASS** | `SaleSyncStatus.toState` re-checks the response shape through `unknown` and degrades to `unavailable`; a rejected invoke is caught → `unavailable`. Tests cover both. |
| A11Y-1 | Accessible status surface | **PASS** | `role="status"` + `aria-live="polite"` (announces without stealing focus); icon + text never colour-only; Arabic-first/RTL; absolute `<time>` with raw ISO. |

## Verdict

**PASS (post-impl walk).** The surface is strictly read-only with no secret/scope leakage; controls
mirror 010's cleared §A4.

## Carry-forward (gated on #349 — same as plan §A5)

- **Live-wiring re-check (T063):** when the engine is wired at the composition root (T062), re-verify
  that the operator token never crosses the bridge in the WIRED path and re-confirm the read-only
  surface against the live `readStatus`. Update this file §-live then.
- The status surface is built + unit-tested but not yet mounted in a pane (deferred like 010's UI);
  mounting is a renderer wiring step, in-scope for the live slice.

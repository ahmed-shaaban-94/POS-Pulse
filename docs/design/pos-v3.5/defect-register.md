# POS v3.5 Convergence — Defect Register

Running log of defects found while converging the terminal onto the v3.5 prototype.
Protocol: spec §6. **Internal** defects are fixed test-first within their slice; **contract**
defects (anything that changes what crosses the wire to Data-Pulse-2) are escalated to the owner
and STOP at the architecture boundary — never fixed unilaterally.

| id | slice | screen / area | description | evidence (file:line) | severity | class (internal\|contract) | status (open\|fixed-with-test\|escalated) |
|----|-------|---------------|-------------|----------------------|----------|----------------------------|-------------------------------------------|
| D-001 | Phase 0 | integration / route-guard test | Flaky test: `cashier-route-enumeration.test.tsx` fails intermittently (2/22 then 22/22 pass with no code change). Pre-existing (introduced PR #398, commit 424a424); touches 0 CSS — unrelated to convergence work. Non-deterministic route-guard `data-testid` assertions. | `tests/integration/renderer/cashier-route-enumeration.test.tsx` | low | internal | open (deferred — out of slice scope; flagged for separate look) |
| D-002 | Phase 0 | tooling / eslint config | `npm run lint` reports ~7426 errors, all `.js` parse errors from the untracked in-tree GitHub Actions runner (`actions-runner/bin/*.js`). `eslint.config.js` `ignores` block omits `actions-runner/**`, so ESLint's project service tries to parse vendored runner JS. Pre-existing (our 2 commits touched 0 `.js` / nothing under actions-runner). CSS is not linted by eslint. Lint gate is red on baseline, independent of convergence. | `eslint.config.js:8` (ignores block) | medium | internal | open (deferred — eslint scope fix; do NOT delete runner per infra rule) |
| D-004 | Slice 1 | shell / nav integration test | Coverage gap (not a code defect): `navigation.test.tsx` `renderApp` helper wires only 5 routes (dashboard/sales/cart/inventory/settings); the new `/app/returns` + `/app/audit` nav entries' click→route-renders path is not exercised in the integration harness. Their link attributes ARE covered at contract level (`NavRail.test.tsx`). | `src/renderer/routes/app/__tests__/navigation.test.tsx:44-54` | low | internal | open (deferred — add returns/audit to renderApp in a later slice or coverage pass) |
| D-003 | Slice 1 | open-shift / operator engine | **CONTRACT GAP — open-shift screen cannot be wired (roadmap-confirmed G2).** Prototype has a full `OpenShiftScreen` (opening float → records openedAt/openedBy → routes to sale). Renderer engine has **no open/start-shift path**: `operator-session-store` models only sign-in/out/takeover; operator bridge has `forceCloseShift`/`listStuckShifts`/`dismissShiftClosedNotice` but **no `openShift`/`startShift`**. **Verified on DP-2 `origin/main` (2026-06-21):** `pos-shifts` module exists but exposes ONLY `GET /api/pos/v1/shifts/stuck` — **no `POST` open-shift operation.** Orchestrator roadmap places open-shift in Phase 4 as UI-shell-only, persistence **deferred & STOP at G2** (POS-015 blocked on DP-2 shift contract). | `bridge-api.ts:360-509`; `operator-session-store.ts:28-46`; DP-2 `pos-shifts.openapi.yaml` (stuck-only); orchestrator roadmap Phase 4 / repo-spec-matrix:137 | high | **contract** | **ESCALATED / G2-DEFERRED (roadmap-tracked).** Open-shift removed from Slice 1 → becomes Slice 12 (UI-shell only). Sign-in + shell proceed (live operator engine). |

## Primitive API baseline (Task 2)

Frozen prop surface of each reused primitive, captured 2026-06-21. Convergence binds to these as-is;
any prototype need beyond this is logged in the table above (internal = additive prop; contract = engine data).

| primitive | file | prop surface (frozen) |
|---|---|---|
| Button | `ui/primitives/Button/Button.tsx` | `intent, size?, children, iconStart?, iconEnd?, disabled?, loading?, type?, onClick?` (+AriaAttributes) |
| Input | `ui/primitives/Input/Input.tsx` | `variant, label, description?, errorMessage?, disabled?, value?, defaultValue?, onChange?` |
| Badge | `ui/primitives/Badge/Badge.tsx` | `intent (info\|success\|warning\|danger\|neutral), children` (+Aria) |
| Card | `ui/primitives/Card/Card.tsx` | `variant?, children, aria-labelledby?` (+Aria) |
| Dialog | `ui/primitives/Dialog/Dialog.tsx` | `open, onOpenChange, variant?, title, description?, children, primaryAction?, secondaryAction?` |
| Table | `ui/primitives/Table/Table.tsx` | `rows, columns, state?, emptyMessage?, errorMessage?` (generic `<Row>`) |
| StatusBanner | `ui/primitives/StatusBanner/StatusBanner.tsx` | `state (ConnectionState), message?` |
| Toast | `ui/primitives/Toast/Toast.tsx` | `intent, title, description?, durationMs?, onDismiss?` |
| PinPad | `ui/operator/PinPad.tsx` | `value, onChange, onSubmit, disabled?` |
| OperatorBadge | `ui/operator/OperatorBadge.tsx` | `display_name, role` |
| AmountPad | `ui/payments/AmountPad.tsx` | `valueMinor, onChange, totalMinor` |
| MoneyRoll | `ui/payments/MoneyRoll.tsx` | `valueMinor, className?` |

**Parity verdict (Task 2):** All primitives are prop-sufficient for the prototype. **No prop-API change
and no contract escalation required.**
- Badge intents match prototype exactly (`info/success/warning/danger/neutral`).
- StatusBanner `ConnectionState` (online/degraded/offline/syncing) covers all prototype banner states.
- Dialog supports the Rx-gate pattern (children + primary/secondary actions; pos-app.jsx:604-633).
- **AmountPad note (internal, no change):** prototype uses free-entry keypad; production `AmountPad`
  takes `totalMinor` for quick-amount suggestions but does not constrain entry, so it expresses the
  prototype's voucher-remainder / insurance-copay / credit-down-payment flows via the existing prop
  surface. Adaptation is at the call site, not the primitive. No D-row needed.

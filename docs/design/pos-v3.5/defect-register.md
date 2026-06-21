# POS v3.5 Convergence — Defect Register

Running log of defects found while converging the terminal onto the v3.5 prototype.
Protocol: spec §6. **Internal** defects are fixed test-first within their slice; **contract**
defects (anything that changes what crosses the wire to Data-Pulse-2) are escalated to the owner
and STOP at the architecture boundary — never fixed unilaterally.

| id | slice | screen / area | description | evidence (file:line) | severity | class (internal\|contract) | status (open\|fixed-with-test\|escalated) |
|----|-------|---------------|-------------|----------------------|----------|----------------------------|-------------------------------------------|
| D-001 | Phase 0 | integration / route-guard test | Flaky test: `cashier-route-enumeration.test.tsx` fails intermittently (2/22 then 22/22 pass with no code change). Pre-existing (introduced PR #398, commit 424a424); touches 0 CSS — unrelated to convergence work. Non-deterministic route-guard `data-testid` assertions. | `tests/integration/renderer/cashier-route-enumeration.test.tsx` | low | internal | open (deferred — out of slice scope; flagged for separate look) |

## Primitive API baseline (Task 2)

Recorded during Phase 0 Task 2 — the frozen prop surface of each reused primitive. Any prototype
need beyond this is logged above as internal (additive prop) or contract (engine data).

_To be filled in Phase 0 Task 2._

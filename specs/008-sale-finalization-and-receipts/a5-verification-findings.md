# 008 §A5 — Verifiable-subset findings (agent-gathered, NOT a sign-off)

> **Status: §A5 remains OPEN.** This document records the machine-verifiable
> subset of the §A5 production-readiness audit. It is evidence for the human
> reviewer, NOT a sign-off. Hardware, craft, and human-judgment gates are
> explicitly left for the owner (see "Owner must clear" below).
>
> Gathered 2026-05-30 on branch `chore/008-a5-verifiable-subset`.

## ✅ Verified (facts the reviewer can rely on)

### T520 — Coverage-floor audit — **PASS**
Full vitest suite green. Global: **95.84% stmts / 92.41% branch / 98.22% fn / 97.76% lines** (5240/5467 stmts).

Per-module line coverage against the ≥95% named-module floor (the aggregate
can hide a single module under floor — these are the per-module checks):

| Module | Lines | Floor | Result |
|:--|:--|:--|:--|
| `src/shared/money.ts` | 100% | 95 | OK |
| `src/shared/payments/money-math.ts` | 100% | 95 | OK |
| `src/main/sales/sale-number-allocator.ts` | 100% | 95 | OK |
| `src/main/receipts/receipts-payload.ts` | 100% | 95 | OK |
| `src/main/receipts/template-engine.ts` | 100% | 95 | OK |
| `src/main/receipts/print-pipeline.ts` + `print-dispatcher.ts` | 100% | 95 | OK |
| `src/main/drawer/drawer-kick.ts` | 100% | 95 | OK |
| `src/main/sales/audit-emitter.ts` | 100% | 95 | OK |
| `src/main/sync-outbox/sale-sync-outbox.repository.ts` | 100% | 95 | OK |
| `src/main/sales/finalize-transaction.ts` | 100% | 95 | OK |
| `src/main/sales/sales-bridge.ts` | 100% | 95 | OK |
| `src/main/receipts/receipts-bridge.ts` | 96.36% | 95 | OK (lowest real module; uncovered = sibling error arms 73/358/399/423) |

Renderer surfaces against the ≥90% floor:

| Surface | Lines | Floor | Result |
|:--|:--|:--|:--|
| `ReceiptPreview.tsx` | 100% | 90 | OK |
| `ReprintAffordance.tsx` | 100% | 90 | OK |
| `PrinterFailureBanner.tsx` | 100% | 90 | OK |
| `DrawerFailureBanner.tsx` | 100% | 90 | OK |

Note: `src/main/drawer/drawer-kick-transport.ts` reports 0/0 lines (NaN). This
is correct — it is a pure DI port/interface file (37 lines, all comment + type
seam; real impl is a stub until T200 hardware bring-up). No instrumentable
logic. Not a coverage gap.

### T528 — CI gates (local) — **PASS** (package:dir is CI-only)
- `npm run typecheck` — exit 0
- `npm run lint` (eslint + prettier --check) — exit 0, "All matched files use Prettier code style"
- `npm test -- --coverage` — full suite pass
- `codegen:verify` — no-op per AD-12 (008 makes zero backend calls); verified green on CI run 26671092551
- `package:dir` — Windows-only CI step; not run locally. **Owner: confirm latest `main` CI package:dir is green.**

### T521 — Redaction audit — **runtime assertion ✅ DONE (2026-05-30); support-bundle audit N/A (no tool exists)**

> **Update 2026-05-30.** The *runtime* assertion below is now done — see
> `coordination.md §"T521 — Runtime redaction assertion"` +
> `tests/integration/sales/t521-runtime-redaction.test.ts` (drives the real
> dispatchers through real pino + a console spy; asserts no forbidden key/value
> at any depth; positive-control proves non-vacuity). The **support-bundle export
> tool** audit is N/A: no such tool exists in `src/` yet (§P11 forward
> requirement recorded). T521 stays OPEN as a checklist item pending the owner
> accepting the support-bundle half as N/A-by-absence; the agent does not
> self-tick it.

What was verified (static):
- No forbidden-field key appears as *data* in `src/main/receipts`. The only
  occurrences are the `FORBIDDEN_KEYS` *guard array* in `receipts-bridge.ts:43-60`
  (the defensive refusal list itself).
- pino `redact` config (`logger.ts`) layers pairing(002)+operator(004)+cart(005)
  +sales `external_reference`(008 T093)+`FORBIDDEN_PAYLOAD_KEYS`(004 T050), each
  at 4 wildcard depths. (NB: `logger.ts:20`'s "redaction deferred" comment is
  STALE 001 boilerplate — redaction IS implemented below it.)

**NOT done — T521 as-specified requires these (owner/reviewer):**
- The *runtime* assertion: capture actual pino log output + Sentry events across
  a full happy-path-plus-failure-paths run and assert ZERO forbidden-key
  occurrences. A static source grep cannot catch a contributor who logs a raw
  object whose shape the `redact` paths miss — which is exactly the failure the
  runtime grep exists to catch.
- The **support-bundle export tool** redaction audit (Constitution §P11) — not
  inspected at all in this pass.

### T527 — safeStorage read-only in 008 — **PASS**
Every `encryptString`/`decryptString` (write-capable) call lives in 001 secrets,
002 pairing, or 004 operator modules. ZERO in 008 territory (`src/main/receipts`,
`src/main/sales`, `src/main/drawer`, `src/main/sync-outbox`). 008 only reads
cached terminal config. Confirmed.

## ✅ T522 — Sentry/pino scrubber decision tree — **RESOLVED (was case (b) BLOCK)**

> **Resolved 2026-05-30** by observability slice `obs/redaction-card-voucher-surface`
> (PR #299): `FORBIDDEN_PAYLOAD_KEYS` was extended to the full AD-9 surface and
> both Sentry scrubbers + pino now derive from that single source of truth (via
> `isForbiddenSentryKey` for Sentry; `logger.ts` already derived `REDACTION_PATHS`
> from the list). The seven previously-uncovered fields (`track1`, `track2`,
> `cryptogram`, `issuer_name`, `receipt_text`, `voucher_code`, `voucher_balance`)
> are now scrubbed by exact-key match. Verified by the auto-extended
> `*-audit-redaction.test.ts` suites (main + renderer + pino) plus the new
> `forbidden-keys-sentry-matcher.test.ts`. The case-(b) block is cleared.
>
> Note (unchanged, out of scope): today's curated substring supplement still
> strips the permitted `voucher_authority_redemption_id` + `intent_token_*`
> reason codes from Sentry (pre-existing `auth`/`token` breadth). Narrowing that
> would *reduce* redaction; tracked separately if desired.

---

**Original finding (historical record):**

T522's tree: ANY AD-9 redaction-surface field NOT covered by the scrubber →
case (b), block §A5 pending a focused observability slice. These are not "might
match but not explicit" (which would be (c)) — they are matched by NOTHING in
either scrubbing layer, which is the literal (b) trigger.

**Finding.** Two scrubbing layers exist:
1. **pino `redact`** — exact-key list. Does NOT enumerate the `data-model.md
   §Forbidden fields` card surface (`pan`, `card_pan`, `cvv`, `track1/2`,
   `cardholder_name`, `auth_payload`, `cryptogram`, `issuer_name`,
   `receipt_text`) nor the voucher-secret surface (`voucher_redemption_intent_token`,
   `voucher_code`, `voucher_balance`, `voucher_holder_pii`).
2. **Sentry `beforeSend` (`scrubEvent`)** — regex SUBSTRING denylist
   `/secret|token|password|credential|card|pii|cvv|pan|email|phone|pin|jwt|clerk|auth|pair/i`
   PLUS full `delete event.request` + `delete event.user`, `integrations: []`,
   `sendDefaultPii: false`, `tracesSampleRate: 0`. Broader than pino, but still
   has NAMED-FIELD GAPS: `track1`/`track2`, `cryptogram`, `issuer_name`,
   `receipt_text`, `voucher_code`, `voucher_balance` are not matched by any
   substring.

**Why this is (b) not (a):** seven AD-9 fields (`track1`, `track2`, `cryptogram`,
`issuer_name`, `receipt_text`, `voucher_code`, `voucher_balance`) are scrubbed
by NEITHER layer — not the pino exact-key list, not the Sentry substring regex.
That is hard non-coverage, the literal (b) trigger. Defense-in-depth is strong
(request/user dropped wholesale; 008 finalize REFUSES these fields at the
006→008 boundary so they never enter an 008 object; tags/breadcrumbs
guaranteed-empty), which makes real leakage unlikely — but T522 audits
*scrubber coverage*, and the (a) "no_change_required" branch requires the
reviewer to record explicit evidence that the residual fields cannot reach a
sink. That override is the owner's to make with documented evidence; the agent
does not assume it.

**Owner decision required** (one of):
- **(a)** Judge the defense-in-depth sufficient + record explicit file/line
  evidence that the residual fields cannot reach a sink → proceed.
- **(b)** Extend the scrubbers' exact-field coverage via a focused
  observability slice (NOT smuggled into 008 per Constitution §P11) → block
  until it merges.

## Owner must clear (hardware / craft / human-judgment — agent cannot)
- **T512** `/impeccable craft 008-printer-failure-banner-manual-override` polish pass + §A1 red-bar record. (Functional core + 100% test coverage already done; only the craft gate is open.)
- **T520a** performance bring-up — ✅ **CLOSED 2026-05-30 (owner-accepted, printer-only).** Re-scoped to printer-only/OS-print (drawer perf descoped); owner (Ahmed) accepted the 2026-05-30 BIXOLON OS-print bench as sufficient in lieu of a quantitative p95 capture. **Honest record: no numeric p95 timings captured** — this is an owner judgment that observed OS-print latency is MVP-acceptable, not a measured pass against the NFR millisecond budgets; the `008-perf-budgets.bench.ts` harness was not authored. See `coordination.md §"Owner bar-answer — 2026-05-30"`.
- **T523** hardware-matrix completeness — ✅ **CLOSED 2026-05-30 (owner-accepted, printer-only).** Option A (**BIXOLON SRP-330 II**) is the accepted 008 §A5 printer target (Epson/APG superseded for MVP; §A3 record unchanged); the BIXOLON printer row is promoted to **tested (owner-accepted)** in `docs/hardware-matrix.md`. **Honest record on rule 1:** no automated CI integration test (CI has no hardware) — promotion rests on the owner-run bench smoke (manual/observed/photo on file), annotated as owner-accepted-not-CI-tested. **Drawer/DK1 DESCOPED** (deferred to a future peripheral spec; drawer code stays); **ESC/POS DESCOPED** (OS-print accepted); scanner = wedge-observed only.

> **2026-05-30 bench-evidence update (observed, NOT sign-off).** Owner ran an additional
> hardware smoke. New evidence recorded in `docs/hardware-matrix.md` + `coordination.md`
> §"§A5 hardware smoke evidence (2026-05-30)":
> - **HONEYWELL HF680-RS-01 REV B** scanned successfully **inside the POS screen** (in
>   addition to the earlier OS-level scan). The rule-1 wedge-into-cart **integration
>   test** is still PENDING; transport mode (wedge-HID vs the `-RS` RS-232 variant) still
>   to be confirmed.
> - **BIXOLON SRP-330 II** printed a **browser/HTML receipt** generated from the
>   POS-Pulse receipt **template engine**. Render quality on the printed slip: Arabic
>   legible, English legible, content fits the 80 mm width, no excess blank paper,
>   feed/cut acceptable; receipt photo on file with owner. **This was NOT the official
>   POS print pipeline** — `main` uses pre-T200 stub transports. POS receipt-pipeline
>   print smoke stays PENDING until T200 wires a real OS-print or ESC/POS adapter;
>   ESC/POS direct path stays unverified. Best observed BIXOLON driver paper setting:
>   **80 × 3276 mm continuous roll** (short fixed forms such as 80 × 287 mm may feed
>   excessive blank paper).
> - **Cash drawer** model still unconfirmed; drawer-kick (DK1 pulse) test still PENDING.
>
> No task is marked complete by this evidence: **T523**, **T520a**, and **T529** all
> remain OPEN.
- **T522** ✅ RESOLVED via observability slice `obs/redaction-card-voucher-surface` (PR #299) — no longer an owner gate.
- **T526** security-review handoff (8-item §A4 checklist) — needs a reviewer.
- **T524 / T525** runbook + rollback docs — ✅ **DONE** (authored in PR #308: `docs/runbook/008-sale-finalization-and-receipts.md`; both ticked in tasks.md).
- **T529** the actual sign-off record (reviewer + date) — by definition human.

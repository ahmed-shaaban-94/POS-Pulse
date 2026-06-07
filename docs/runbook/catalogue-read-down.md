# Runbook — Catalogue Read-Down (010)

Operational guide for the catalogue read-down subsystem: how it fills the local
`products` / `product_barcodes` read model from the backend snapshot, how to
trigger a refresh, and how to triage a "catalogue unavailable" or stale-catalogue
report. **Read direction only** (backend → local); there is no POS→backend write
on this surface.

> **Status (2026-06-07):** the offline correctness core (migrations, writer,
> driver, bridge, freshness UI) is implemented and tested. The **live HTTP
> client + composition-root wiring are deferred on D-DEPLOY (issue #349)** — until
> the backend serves the deployed contract and `api-types.ts` is re-pinned, the
> read-down driver has no live client and the catalogue stays empty in
> production. This runbook describes the system as designed; the live-fetch legs
> activate when #349 clears.

## What it does

1. A background driver (`read-down-driver.ts`) runs `runTickOnce()` on a paired
   terminal (Constitution VIII — NOT operator-session-gated): app-start /
   post-pairing + on an interval, and on a manual `catalogue:refresh` from the
   cashier.
2. Each tick fetches a full sellable-catalogue snapshot from the backend
   (`Authorization: Bearer <device_token>`), validates + maps each row, stages
   it, and **promotes in one transaction** (DELETE live + INSERT…SELECT from
   staging + write `last_success_at`).
3. 009's lookup/search then resolves real products offline.

## Manual refresh

The cashier triggers a refresh from the catalogue pane freshness indicator
("تحديث الكتالوج"). It reports `started` or `already_running` (single-flight) and
never blocks selling. The result surfaces on the next freshness read, not as a
"done" toast (the system never claims a promote that hasn't committed).

## Freshness states (what the cashier sees)

| Indicator | Meaning | Action |
| :--- | :--- | :--- |
| لم يُنزّل الكتالوج بعد (never downloaded) | `last_success_at` is null — no read-down ever succeeded | Confirm pairing + network; trigger a manual refresh. If it stays empty, see "Catalogue unavailable" below. |
| آخر تحديث: \<time\> (last updated) | A read-down committed and products exist | Healthy. |
| تم التحديث، لكن لا توجد منتجات (updated, no products) | A read-down committed but the backend returned an EMPTY sellable set | Backend-side: the store has no sellable catalogue. Escalate to the platform team — this is not a terminal fault. |
| حالة الكتالوج غير متاحة (status unavailable) | The freshness read was refused (no session / tenant mismatch) | Sign in; if it persists, escalate (possible pairing/scope misconfiguration). |

## Triage: "catalogue unavailable" / search finds nothing

1. **Is the terminal paired?** The driver needs the device token. Unpaired → no
   read-down. Check pairing status.
2. **Has a read-down ever succeeded?** Freshness = "never downloaded" → no
   successful promote yet. Trigger a manual refresh and watch the indicator.
3. **Network reachable?** A transport failure (`no_connection`/`failed`) records
   a failed attempt and PRESERVES the prior catalogue; `last_success_at` does not
   advance. The freshness indicator keeps showing the last good time.
4. **Backend serving the contract?** Until #349 clears, the live client is not
   wired — the catalogue stays empty by design. Confirm the deploy status.
5. **Over-threshold rejection?** If the snapshot was mostly malformed (a
   source-format break), the run FAILS with no promote and the prior catalogue is
   kept. See `failure-modes.md`.

## Diagnostics

- `catalogue_sync_state` (one row per tenant) holds `last_success_at`,
  `last_attempt_at`, `last_outcome` (`succeeded` / `failed` /
  `skipped_with_rejections`), and the opaque `source_snapshot_id`. It holds NO
  secret and NO PII.
- The device token and the raw snapshot body are NEVER logged (redaction smoke
  T018; forbidden-keys list).

## Related

- Rollback: [`../../specs/010-pos-catalog-read-down-consumption/rollback.md`](../../specs/010-pos-catalog-read-down-consumption/rollback.md)
- Failure modes: [`../../specs/010-pos-catalog-read-down-consumption/failure-modes.md`](../../specs/010-pos-catalog-read-down-consumption/failure-modes.md)
- Migration safety: `specs/010-.../migration-review/s1-migration-review.md`
- Bridge security: `specs/010-.../security-review/s4-review.md`

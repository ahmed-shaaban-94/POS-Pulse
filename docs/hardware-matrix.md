# POS-Pulse Hardware Matrix

## Overview

POS-Pulse is a Windows-only POS terminal for the SmartDataPulse pharmacy platform. The
**hardware matrix** defines what physical devices the application is built and tested against
during the MVP. The matrix is deliberately narrow: shipping a small, well-supported set of
devices is preferable to advertising broad compatibility that the team cannot guarantee.

This document is a **reproduction**, not a redefinition. The authoritative source is
[`.specify/memory/constitution.md`](../.specify/memory/constitution.md) § Hardware (constitution
v1.3.0; scope originally established at v1.2.0). Any conflict between this file and the
constitution is resolved in favor of the constitution. Expanding either the In-Scope or
Out-of-Scope list requires a constitution amendment — see [How to update this doc](#how-to-update-this-doc).

The tested-models tables under each In-Scope category are intentionally empty in feature
`001-foundation`. Foundation does not exercise real hardware; it lays the substrate. Concrete
device entries land in feature `002-terminal-pairing` and the hardware-driver features that
follow.

## In Scope (MVP)

The four categories below are the only hardware surfaces POS-Pulse is built to support during
the MVP. A device that is not listed here is not supported.

### Workstation

Windows 10 or Windows 11 desktop or laptop, x64. This is the single primary build target. The
unsigned `--dir` build artifact produced by `npm run package:dir` (CI, `windows-latest`) MUST
launch on a clean Windows 10 or Windows 11 x64 machine without the development environment
installed (NFR-5).

| Model | Transport | Driver / firmware | Tested in feature | Known caveats |
|:------|:----------|:------------------|:------------------|:--------------|
| _None tested yet — first entry lands in feature 002+_ |  |  |  |  |

### Barcode scanner

**Keyboard-wedge (HID) only.** Scanners present themselves as keyboards and emit barcode data
as keystrokes. POS-Pulse does NOT integrate native scanner SDKs (Honeywell, Zebra DataWedge as
a native bridge, etc.) — wedge mode is the only transport.

| Model | Transport | Driver / firmware | Tested in feature | Known caveats |
|:------|:----------|:------------------|:------------------|:--------------|
| _OBSERVED (not promoted to tested)_ — **HONEYWELL HF680-RS-01 REV B** | Keyboard-wedge (HID) expected; model carries an **-RS** suffix implying an RS-232 variant — confirm wedge/HID mode before promotion | OS-level HID; no native SDK (wedge-only per scope) | 008 §A5 bench (observed 2026-05-30; see [specs/008-sale-finalization-and-receipts/coordination.md](../specs/008-sale-finalization-and-receipts/coordination.md) §"§A5 hardware smoke evidence (2026-05-30)") — **not promoted to a tested row; wedge-into-cart *integration test* still PENDING** | General scan smoke **passed** at the OS level (scanner emits data), AND an **in-POS screen scan smoke passed** (scanner data captured inside the POS screen on 2026-05-30). What remains: the automated **wedge-into-cart integration test** required by rule 1 before promotion (manual in-POS capture is not the integration test). Transport mode (wedge-HID vs RS-232) **to be confirmed** — scope is wedge-HID-only (rule 2). Differs from the §A3-committed scanner expectation; divergence flagged in coordination.md for owner review. |

### Receipt printer

A local print adapter routes through the system printer queue. The **ESC/POS direct path is
preferred** when the connected printer supports it; printers that do not are driven through
the OS print path as a fallback. The choice is made per-printer, not per-feature: the receipt
template engine emits both an ESC/POS byte stream and a printable HTML/canvas fallback so the
same template renders on either path.

| Model | Transport | Driver / firmware | Tested in feature | Known caveats |
|:------|:----------|:------------------|:------------------|:--------------|
| _PENDING_ — **Epson TM-T20III** | USB (serial fallback supported) | Epson Advanced Printer Driver (APD) v5.13+; ESC/POS direct command set | 008 (committed at T006 2026-05-26 in [specs/008-sale-finalization-and-receipts/coordination.md](../specs/008-sale-finalization-and-receipts/coordination.md) §"§A3 hardware-matrix coordination thread"); promotion to "tested" row at Slice 3 T200 hardware bring-up | None known; widely deployed in MEA pharmacy retail. ESC/POS direct path is preferred; OS-print fallback works on same physical device. **NOTE:** the §A5 bench (2026-05-30) observed a different physical printer — **BIXOLON SRP-330 II** (row below). Divergence from this §A3-committed target flagged in coordination.md for owner review. |
| _OBSERVED (not promoted to tested)_ — **BIXOLON SRP-330 II** | USB (OS print queue); ESC/POS-capable thermal printer (direct path not yet exercised) | Vendor driver **installed**; ESC/POS direct command set expected but unverified on this unit. **Best observed driver paper setting: 80 × 3276 mm continuous roll** (see caveats) | 008 §A5 bench (observed 2026-05-30; see [specs/008-sale-finalization-and-receipts/coordination.md](../specs/008-sale-finalization-and-receipts/coordination.md) §"§A5 hardware smoke evidence (2026-05-30)") — **not promoted to a tested row; POS-pipeline receipt print + ESC/POS direct integration test PENDING** | Windows **OS test-page printed successfully** (driver/transport proven). A **browser/HTML receipt-template smoke also passed** — an HTML receipt generated from the POS-Pulse receipt **template engine** was printed via the browser. **This was NOT the official POS print pipeline:** `main` currently uses pre-T200 **stub transports**, so the real OS-print / ESC-POS adapter path is not yet exercised. **POS receipt-pipeline print smoke remains PENDING** until T200 wires a real OS-print or ESC/POS adapter. **ESC/POS direct path NOT yet verified.** **Paper setting:** the best observed driver setting is **80 × 3276 mm continuous roll** — short fixed forms such as 80 × 287 mm may feed excessive blank paper; the 80 × 3276 mm continuous roll produced the best observed cut/feed behavior. Differs from the §A3-committed Epson TM-T20III target; divergence flagged in coordination.md for owner review. |

### Cash drawer

**Optional.** Cash drawers are opened by sending the kick command (DK1 or DK2 ESC/POS pulse)
through the receipt printer; POS-Pulse does not drive cash drawers directly. A failed
drawer-open command MUST surface a manual-override path per Constitution Principle IV — it
MUST NOT block the receipt print, and it MUST NOT auto-dismiss.

| Model | Transport | Driver / firmware | Tested in feature | Known caveats |
|:------|:----------|:------------------|:------------------|:--------------|
| _PENDING_ — **APG VBS320 (Vasario)** | RJ-12 to printer (DK1 pulse) | Driven via Epson TM-T20III's DK1 ESC/POS command; no native USB driver required | 008 (committed at T006 2026-05-26 alongside the TM-T20III printer pairing; promotion to "tested" row at Slice 4 drawer-kick bring-up) | None known. Pairs natively with TM-T20III via the printer's DRAWER port. Drawer-kick is a printer ESC/POS DK1 command, not a peripheral driver call. Satisfies AD-8 separate-command requirement (no embedded-in-receipt kick). **NOTE (2026-05-30 §A5 bench):** no cash-drawer model was observed on the bench — **drawer model unconfirmed; drawer-kick (DK1 pulse) test PENDING.** See coordination.md §"§A5 hardware smoke evidence (2026-05-30)". |

## Out of Scope (MVP)

The following are **explicitly NOT supported** in the MVP. Adding any of them requires a
constitution amendment, not a doc edit.

- Android, iPad, iPhone, or any non-Windows POS form factor.
- Label printers and scales.
- Customer-facing displays (CFD / pole displays).
- Direct integration with card terminals (PIN pads, mPOS readers). Card capture stays on a
  separate PCI-DSS certified device per Constitution § Security.
- Native scanner SDKs (Honeywell, Zebra DataWedge as a native bridge, etc.) — wedge mode only.

## Operational rules

These rules are reproduced from constitution § Hardware. They constrain how POS-Pulse handles
the In-Scope hardware surface at runtime and at change-time.

1. **Tested-models registry MUST be kept in sync with reality.** Adding a model to any of the
   In-Scope tables above requires (a) updating the table in this file with the model's
   transport, driver/firmware version, and known caveats, AND (b) adding an integration test
   that exercises the device. A pull request that adds a model without both is incomplete.
2. **Wedge focus management.** Barcode scanner input is treated as keyboard input by default.
   The focus-management strategy MUST prevent stray scans from polluting unrelated fields. The
   pairing screen and the cart screen are the two contexts where wedge input is accepted by
   design; all other contexts MUST guard against accidental capture.
3. **Receipt template versioning.** Receipt templates are version-controlled assets, not
   hardcoded strings. The template engine MUST emit both an ESC/POS byte stream and a printable
   HTML/canvas fallback so the same template renders on the direct-print and OS-print paths
   without divergence.
4. **Hardware failures are loud, not silent** (Constitution Principle IV). A failed cash-drawer
   kick MUST surface a manual-override path; it MUST NOT block the receipt print and MUST NOT
   auto-dismiss. A failed receipt print MUST surface a retry/reprint affordance. A degraded
   mode (e.g., printer offline) is permitted, but the UI MUST display a persistent banner
   until the device recovers — silent degradation is PROHIBITED.

## How to update this doc

This document is a registry, not a policy. Two kinds of changes land here, and they have
different requirements.

**Adding or modifying a tested-model row** (incremental — most common case):

1. Update the relevant table in [In Scope (MVP)](#in-scope-mvp) with the new row.
2. Replace the placeholder row (`_None tested yet — first entry lands in feature 002+_`) the
   first time a category gains its first real entry.
3. Add or update an integration test that exercises the device. A row without a test is
   incomplete (rule 1 above).
4. If a model is removed because it failed verification, leave a brief note in **Known
   caveats** rather than silently deleting the row — future contributors benefit from knowing
   what was tried.

**Changing the In-Scope or Out-of-Scope list itself** (out-of-band — rare):

This requires a **constitution amendment**, not a doc-only edit. The procedure is documented
in [`.specify/memory/constitution.md`](../.specify/memory/constitution.md) § Governance →
Amendment Procedure. A pull request that edits the In-Scope or Out-of-Scope categories of this
file without a parallel constitution amendment in the same PR is out of bounds and MUST be
rejected at review.

Foundation (feature `001-foundation`) deliberately leaves the tested-models tables empty.
First entries land in `002-terminal-pairing` and the hardware-driver features that follow it.

## Source of truth

This file reproduces constitution v1.3.0 § Hardware (scope originally established at v1.2.0).
The authoritative source is [`.specify/memory/constitution.md`](../.specify/memory/constitution.md)
§ Hardware. If a contributor reads this file and finds it inconsistent with the constitution,
the constitution wins; the inconsistency is a defect in this file and MUST be fixed in the
same PR that surfaces it.

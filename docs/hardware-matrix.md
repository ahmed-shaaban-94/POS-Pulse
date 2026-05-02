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
| _None tested yet — first entry lands in feature 002+_ |  |  |  |  |

### Receipt printer

A local print adapter routes through the system printer queue. The **ESC/POS direct path is
preferred** when the connected printer supports it; printers that do not are driven through
the OS print path as a fallback. The choice is made per-printer, not per-feature: the receipt
template engine emits both an ESC/POS byte stream and a printable HTML/canvas fallback so the
same template renders on either path.

| Model | Transport | Driver / firmware | Tested in feature | Known caveats |
|:------|:----------|:------------------|:------------------|:--------------|
| _None tested yet — first entry lands in feature 002+_ |  |  |  |  |

### Cash drawer

**Optional.** Cash drawers are opened by sending the kick command (DK1 or DK2 ESC/POS pulse)
through the receipt printer; POS-Pulse does not drive cash drawers directly. A failed
drawer-open command MUST surface a manual-override path per Constitution Principle IV — it
MUST NOT block the receipt print, and it MUST NOT auto-dismiss.

| Model | Transport | Driver / firmware | Tested in feature | Known caveats |
|:------|:----------|:------------------|:------------------|:--------------|
| _None tested yet — first entry lands in feature 002+_ |  |  |  |  |

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

# `/impeccable` Embed Preflight

> Authoritative checklist for embedding the `/impeccable` skill into a Spec Kit feature's `tasks.md` to drive UI decisions and polish.
>
> **Status:** ACTIVATING v0.4 — written 2026-05-27 in service of `specs/008-sale-finalization-and-receipts`. Apply to 008 first; promote to general use only after 008 §A5 sign-off retrospects this pattern.
>
> **v0.4 changelog (2026-05-27 — activation PR):** Activation discovery — `docs/design-system.md` was already a complete Stitch-format DESIGN.md (YAML frontmatter + all six sections + the "Accountable Instrument" North Star + Named Rules). The preflight's v0.3 premise that DESIGN.md needed to be generated from scratch was therefore wrong. The activation PR resolves this with a `git mv docs/design-system.md docs/DESIGN.md` (history-preserving), updates the three repo references (this preflight, `docs/README.md`, root `README.md`), and rewrites P2 + §9 to reflect that DESIGN.md is now present in canonical form. The `/impeccable document` step is **skipped** because the artifact already exists in the right shape under a different name. `specs/007-pos-visual-system/` remains as a secondary reconciliation reference for any visual decisions that didn't make it into DESIGN.md.
>
> **v0.3 changelog (2026-05-27):** Metadata/path fix — corrected every reference to the product context file from the uppercase `docs/PRODUCT.md` to the actual on-disk lowercase `docs/product.md`. Reframed `docs/DESIGN.md` as an **activation artifact** that the embed creates (via `/impeccable document` reconciled against existing sources), not a precondition that must already exist on `main`. `docs/design-system.md` and `specs/007-pos-visual-system/` remain the reconciliation sources (inputs to DESIGN.md authoring, not substitutes for it). *(Superseded by v0.4 — the artifact existed all along.)*
>
> **v0.2 changelog (2026-05-27):** External review applied — corrected `src/shared/money/` → `src/shared/payments/money-math.ts` (C1); added tag stacking order to §4 (C2); reconciled §A1 gate definition vs tasks.md line 78 (C3); added `docs/design-system.md` + 007 reconciliation to P2 (H1); pinned T-numbers to current tasks.md state (H2); scoped §3 shape-brief coverage to renderer-only surfaces (H3); added pre-craft red-bar check to §4 (H4).

---

## 0. Intent

`/impeccable` (`C:\Users\user\.claude-personal\skills\impeccable`) is the frontend-design skill that drives:

- **Shape** — UX/UI plan before code, confirmed by the user against `docs/product.md` anti-references and design principles.
- **Craft** — production-grade implementation that satisfies the shape brief.
- **Polish / critique / audit / harden** — refinement passes against shipped UI.

Embedding it into a Spec Kit feature means: the §A1 visual-direction gate and each renderer-surface build task delegate to `/impeccable` for direction and polish, rather than writing those decisions ad-hoc.

This preflight is the gate that says **the feature is ready for the embed**. If any check below fails, the embed MUST NOT begin until the failure is resolved.

---

## 1. Scope of an embed

An embed is **bounded**. For 008, the embed scope is:

| In scope | Out of scope |
|:--|:--|
| `src/renderer/ui/receipts/` (`<ReceiptPreview>`, `<PrinterFailureBanner>`, `<DrawerFailureBanner>`, `<ReprintAffordance>`, manual-override surfaces) | `src/main/receipts/templates/` (ESC/POS byte generation — no register applies) |
| `src/renderer/ui/banners/BannerHost.tsx` extensions for 008-specific banners | `src/main/sales/`, `src/main/drawer/`, `src/main/sync-outbox/` (main-process logic) |
| `specs/008-sale-finalization-and-receipts/visual-direction/README.md` (the §A1 deliverable) | The receipt template engine's bilingual asset content (copy and ESC/POS layout are governed by FR-017, not aesthetics) |
| Slice 0 visual direction (T010–T020 §A1 tasks) | Migrations, repositories, bridge handlers, audit emitters, sync-outbox enqueuers |
| Per-component shape + craft + polish for renderer tasks T173 / T290 / T360 / T450 / T512 | Tests already on the board (T150 / T260 / T330 / T430 etc.) — see §5 below |

The receipt template's printed slip is **dual-output** (ESC/POS bytes + HTML/canvas preview). `/impeccable` covers the HTML/canvas preview register only; the ESC/POS byte stream is governed by the spec's FR-017 canonical fields and template engine contract, not by aesthetic decisions.

---

## 2. Prereqs (hard — no exceptions)

Every prereq below MUST pass before the embed activates. Each row is a blocker.

| # | Prereq | Verification | Why |
|:--:|:--|:--|:--|
| P1 | `docs/product.md` exists, ≥ 200 chars, no `[TODO]` markers | `node .claude/skills/impeccable/scripts/load-context.mjs` → `hasProduct: true` | `/impeccable` refuses to design without product context. |
| P2 | `docs/DESIGN.md` exists at `docs/DESIGN.md`, in Stitch DESIGN.md format (YAML frontmatter + six fixed sections + Named Rules). The file is `/impeccable`-loader-readable via the skill's standard `docs/` fallback. | (a) Confirm `docs/DESIGN.md` is present (renamed from `docs/design-system.md` in the activation PR). (b) Confirm the loader resolves it: `node .claude/skills/impeccable/scripts/load-context.mjs` returns `hasDesign: true`. (c) Spot-check the six sections (Overview, Colors, Typography, Elevation, Components, Do's and Don'ts) are present and the Creative North Star is articulated. | `/impeccable` reads `DESIGN.md` (case-insensitive) at root or in `docs/`; without it, the skill operates from PRODUCT.md alone and produces less-on-brand output. The pre-existing `docs/design-system.md` was already in Stitch format; the activation PR renamed it to satisfy the loader's expected filename without regenerating the content. |
| P3 | `register=product` recorded in `docs/product.md` | `grep -n 'register' docs/product.md` | 008 is a product surface (terminal UI), not a brand surface. Mismatched register loads the wrong reference and produces marketing aesthetics. |
| P4 | §A1 visual-direction reviewer named in `coordination.md` | Task T005 complete | The reviewer adjudicates `/impeccable`'s shape brief. Without a named owner, the shape-pass gate cannot be cleared. |
| P5 | Constitution v1.5.1 (or later) read by the embedder | Section §IV (44×44 invariant), §P8 (no copy-paste from `_reference/Data-Pulse/`), §P11 (PII / cards never in logs), §P14 (a11y AA + axe-core) | `/impeccable` does not know constitution rules; the embedder enforces them in the post-craft checklist (§7 below). |
| P6 | TDD posture: failing test exists for each component before craft begins | Tasks T150 / T260 / T330 / T430 (and analogues for new components) are written first | `/impeccable craft` is **shape-driven**, not test-driven. The failing test is the load-bearing contract; impeccable's output must satisfy it. Reversing the order risks impeccable producing UI that the test then forces a rewrite of. |

If P1 passes but P2's loader check returns `hasDesign: false`, **do not let `/impeccable` proceed**. Verify `docs/DESIGN.md` is committed (the activation PR landed `git mv docs/design-system.md docs/DESIGN.md`) before re-running the loader. `specs/007-pos-visual-system/` remains a secondary reference for any visual decisions not captured in DESIGN.md.

---

## 3. The §A1 / shape-brief collision (resolve before embed)

### 3.1 §A1 gate definition — pre-reconciliation

`tasks.md` line 78 currently reads: *"§A1 — Visual direction Slice 0 | ⛔ Held; gated on `/speckit-analyze`"*. The "gated on `/speckit-analyze`" framing is **stale post-PR #238** (which merged the analyze remediations). The active 008 §A1 gate is the **visual-direction reviewer sign-off on `specs/008-sale-finalization-and-receipts/visual-direction/README.md`** (tasks T010 + T011). This preflight assumes that interpretation.

**Activation prereq (§9):** before signing this preflight, update `tasks.md` line 78's §A1 row to reflect the reviewer-sign-off framing, OR confirm with the §A1 owner that the visual-direction-reviewer gate is in fact the §A1 deliverable. If the two interpretations disagree, **stop and escalate** — the preflight cannot be activated against an ambiguous gate definition.

### 3.2 The collision

Both `/impeccable shape` and §A1 require a human confirmation step:

- `/impeccable shape` requires the **user** to confirm the shape brief before craft proceeds (`shape=pass` only after explicit approval).
- §A1 (per the reconciled definition above) requires the **named visual-direction reviewer** to sign off on `visual-direction/README.md` before Slices 1 / 2 / 3 / 5 renderer-touching tasks can ship.

**Decision: these are one event, not two.** The §A1 reviewer **is** the user who approves `/impeccable`'s shape brief. The shape brief, once confirmed, **is** the content of `visual-direction/README.md`.

### 3.3 Coverage scope of the shape brief

`/impeccable` is a **web-frontend** skill. T010 in tasks.md requires seven sub-items, including the **printed-slip variants** (`first_print` (a), `reprint_duplicate` (b)). The shape brief covers the renderer-surface portion only:

| T010 sub-item | Covered by `/impeccable shape`? | Owner |
|:--|:--:|:--|
| (a) `first_print` printed-slip layout | ❌ | §A1 reviewer (separately, using the existing visual-direction template) |
| (b) `reprint_duplicate` printed-slip layout | ❌ | §A1 reviewer (separately) |
| (c) `preview` variant content | ❌ (printed-slip content, mirrors (a)) | §A1 reviewer |
| (d) preview UI panel | ✅ | `/impeccable shape` |
| (e) reprint affordance | ✅ | `/impeccable shape` |
| (f) persistent printer-failure banner | ✅ | `/impeccable shape` |
| (g) persistent drawer-failure manual-override banner | ✅ | `/impeccable shape` |

The §A1 reviewer signs off on the **combined** `visual-direction/README.md`, which is assembled from both (a/b/c — reviewer-authored) and (d/e/f/g — `/impeccable`-drafted, reviewer-approved).

### 3.4 Procedure

1. `/impeccable shape 008-receipt-surfaces` runs in Slice 0 (during T010), covering only sub-items (d)/(e)/(f)/(g).
2. The §A1 reviewer authors sub-items (a)/(b)/(c) using the existing visual-direction template (printed-slip layout is outside `/impeccable`'s register).
3. The combined draft is presented to the §A1 reviewer for sign-off.
4. The §A1 reviewer's approval is recorded in `coordination.md` AND committed as `specs/008-sale-finalization-and-receipts/visual-direction/README.md`.
5. §A1 gate is marked ✅ cleared at the same moment `shape=pass` is recorded. No second sign-off is generated.

If the §A1 reviewer is not available to run the `/impeccable shape` session live, the embedder MAY draft the renderer-portion of the shape brief autonomously and submit it asynchronously for §A1 review — but `shape=pass` is **not** recorded until §A1 signs off. Craft is blocked until then.

---

## 4. Embed pattern (the marker syntax)

Embed markers are added to tasks.md tasks that delegate to `/impeccable`. They are **not** new tasks; they are inline directives on existing T-numbered tasks.

### 4.1 Tag stacking order

tasks.md uses a fixed tag order, defined in its "Conventions" block (line 24): `[P?] [USn?] [§Ag?]`. The `[IMPECCABLE …]` marker is appended **after** all existing tags, immediately before the description text:

```
- [ ] **T0NN** [P?] [USn?] [§Ag?] [IMPECCABLE <verb>] Description — path
```

Stacking rules:
- Never reorder existing tags. Append `[IMPECCABLE]` only.
- Multiple `[IMPECCABLE]` markers on a single task are forbidden — split into two T-numbers if a task delegates to two verbs (e.g., shape + image-probe).
- `[IMPECCABLE]` is allowed on `[P]`-tagged tasks **only** if the `/impeccable` session for each parallel task is fully self-contained (no shared shape-brief draft). For shape tasks this is almost never true; for craft tasks against unrelated components it can be.

### 4.2 Pre-invocation red-bar check (TDD enforcement)

Before invoking any `[IMPECCABLE craft]` marker, the embedder MUST confirm the failing tests for the target component are **RED locally**:

```bash
npm test -- --run <test-file-pattern>
```

For T290 (`<PrinterFailureBanner>`), the red-bar set is T260 / T261 / T262 / T263 — i.e., the four `.test.tsx` files under `tests/unit/renderer/receipts/PrinterFailureBanner.*`. The embedder records the red-bar confirmation in `coordination.md` against the T-number before invoking craft. **A craft marker invoked against green tests is a preflight violation** — the contract enforcement fails open silently otherwise.

The red-bar check does NOT apply to `[IMPECCABLE shape]` (no implementation exists yet) or `[IMPECCABLE polish]` (post-merge, all tests green by definition).

### 4.3 Slice 0 (visual direction)

Existing T-numbered tasks under "Phase 2 — Slice 0: Visual direction (NO CODE)" get an `[IMPECCABLE shape]` marker appended:

```markdown
- [ ] **T010** [§A1] [IMPECCABLE shape] Generate the renderer-surface portion (sub-items d / e / f / g per `docs/impeccable-embed-preflight.md §3.3`) of the 008 visual-direction shape brief via `/impeccable shape 008-receipt-surfaces`. Output merges with the §A1 reviewer-authored printed-slip sub-items (a / b / c) into `specs/008-sale-finalization-and-receipts/visual-direction/README.md`. §A1 reviewer is the shape-brief approver per `docs/impeccable-embed-preflight.md §3` — `specs/008-sale-finalization-and-receipts/visual-direction/README.md`
```

The marker `[IMPECCABLE shape]` tells the implementing agent: invoke `/impeccable shape` with the given target. Do **not** invent the shape brief inline; let the skill run.

### 4.4 Per-component renderer tasks

Each renderer-implementation task gets a `[IMPECCABLE craft]` marker that points back to the shape brief. The five attach points in 008 are:

| T-number | Component | Red-bar test set |
|:--:|:--|:--|
| T173 | `<ReceiptPreview>` | T150 / T151 / T152 |
| T290 | `<PrinterFailureBanner>` | T260 / T261 / T262 / T263 |
| T360 | `<DrawerFailureBanner>` | T330 / T331 / T332 |
| T450 | `<ReprintAffordance>` | T430 / T431 |
| T512 | Manual receipt override (extends T290) | T501–T504 (manual-override tests in Slice 6) |

Example marker on T290:

```markdown
- [ ] **T290** [US1] [IMPECCABLE craft] Implement `<PrinterFailureBanner>` per `/impeccable craft 008-printer-failure-banner` against the §A1 shape brief; subscribes to `sales.subscribe(topic='banner_state')`; renders the three affordances; no auto-dismiss; ≥44×44 controls. Component MUST satisfy the failing tests already written in T260 / T261 / T262 / T263 (red-bar confirmation per `docs/impeccable-embed-preflight.md §4.2` recorded before invocation) — `src/renderer/ui/receipts/PrinterFailureBanner.tsx`
```

The marker means: `/impeccable craft` is the design engine, but the failing tests are the contract. Craft must satisfy the contract as written; the red-bar check confirms the tests exist and are failing before craft fires.

### 4.5 Polish phase (Slice 6 / §A5)

A new optional polish marker can appear in Slice 6 or §A5 tasks:

```markdown
- [ ] **TPOLISH-1** [§A5] [IMPECCABLE polish] Run `/impeccable polish src/renderer/ui/receipts/` against the four merged renderer surfaces. Apply suggested refinements that do NOT change a test contract, a constitution rule, or an FR; surface anything that would as a §A5 reviewer question — `specs/008-sale-finalization-and-receipts/coordination.md`
```

Polish is **subordinate to tests and constitution**. The marker syntax makes this explicit.

---

## 5. Tests-as-truth (the TDD reconciliation)

`/impeccable craft` defaults to a shape→implement flow that does not assume failing tests exist upstream. In a Spec Kit embed, **tests exist first and are the contract**. The embed pattern resolves this with three rules:

1. **Craft satisfies tests as-written.** Impeccable MUST NOT modify the tests in T150 / T260 / T330 / T430 (etc.) to fit its preferred shape. If a test enforces a constraint impeccable wants to change, escalate to the §A1 reviewer with a written rationale; do not edit the test.
2. **Constitution rules are tests-by-proxy.** The 44×44 touch-target floor, the no-floats-for-money rule, the RTL default, and the no-`_reference/Data-Pulse/`-copy rule have CI invariants attached. Impeccable's output must pass these too.
3. **Where tests are silent, shape wins.** Visual rhythm, spacing, color strategy, typographic hierarchy, motion easing — these are usually not test-encoded. The shape brief governs them. The §A5 polish reviewer evaluates them.

---

## 6. Image gate (do not reflexively skip)

`/impeccable shape` has an image gate: it expects visual probes or mocks, OR a recorded reason to skip.

For 008, **do not skip**. The product has strong anti-references (no SaaS aesthetics, no glassmorphism, opaque panels, no metric-hero cards) and a deliberate single-light-theme stance. Visual probes are how the embedder catches a drift toward category-reflex aesthetics (e.g., "POS → dark green checkout").

Probes to generate during Slice 0:

- `<PrinterFailureBanner>` and `<DrawerFailureBanner>` in failure state, side-by-side, with the printer-failure banner stacked on top per NFR-008. Probe the visual differentiation between the two so the cashier never confuses them.
- `<ReceiptPreview>` panel rendering the `first_print` template variant, with the cashier mid-shift able to scroll without losing the next-sale affordance (FR per T151 non-blocking).
- `<ReprintAffordance>` in both gated-off (no successful print yet) and gated-on states, to confirm AD-10's precondition is visually legible.
- Manual-override button placement on `<PrinterFailureBanner>` and the post-override dismiss state.

Image gate skip is recorded in `coordination.md` only with a concrete reason ("hardware-matrix bring-up scheduled for week N, probes deferred to that session") — never "skipped: not needed".

---

## 7. Post-craft constitution checklist (the embedder enforces)

After each `[IMPECCABLE craft]` task completes, the embedder runs this checklist against the produced code. `/impeccable` does NOT know these rules; the embedder is responsible.

- [ ] **No floats for money.** Any displayed money value uses the integer-minor-units formatter, not `toFixed` on a float. (`src/shared/payments/money-math.ts` is the only legal source.)
- [ ] **No copy-paste from `_reference/Data-Pulse/`.** Constitution §P8. Re-derived only.
- [ ] **RTL default.** Component layout works in `dir="rtl"` without horizontal scroll, mirrored chevrons, or trapped focus order.
- [ ] **44×44 invariant.** All interactive elements (buttons, links acting as buttons, dismissable banner controls) clear the 44×44 CSS-px floor. Enforced by CI invariant; embedder confirms locally first.
- [ ] **No optimistic UI past a durable commit boundary.** `docs/product.md` Principle 1 — Honest surfaces. `/impeccable`'s defaults occasionally show success affordances before a confirmed result; remove any such affordance.
- [ ] **No PII / card data in logs.** Constitution §P11. The post-craft component must not `console.log`, `pino.info`, or Sentry-capture any payload that includes operator full names, customer info, voucher tokens, card pan/issuer, or pin records.
- [ ] **No bridge-API call outside the typed preload bridge.** Renderer reaches main exclusively through `src/shared/bridge-api.ts`. No direct `ipcRenderer` access in the produced component.
- [ ] **Reduced-motion respected.** Any animation `/impeccable` introduces wraps in `prefers-reduced-motion: reduce` no-op.
- [ ] **Axe-core clean** on the default state. CI runs this; the embedder runs `npx axe <component>` locally first.

Failing any line = the craft task is NOT marked complete. Open a fixup commit before moving on.

---

## 8. What `/impeccable` is NOT used for in 008

For clarity, explicit non-uses:

- Receipt copy text (FR-017 canonical fields; bilingual asset content is in `specs/008-.../contracts/`).
- ESC/POS byte layout (template engine concern; outside any register).
- Cash-drawer kick command timing or retry logic (main-process, AD-8).
- Bridge-API method names or payload shapes (locked in `contracts/bridge-api.md` and reviewed under §A4).
- Audit-event category enums (extended by migration T026; locked).
- Sync-outbox row shape or polling worker (AD-2 v3; main-process).
- `docs/runbook/008-sale-finalization-and-receipts.md` content (T524; operational, not visual).

If a `[IMPECCABLE]` marker shows up on any of the above, it's a preflight violation — reject the embed and reopen the prereq review.

---

## 9. Activation checklist (sign here before tasks.md is amended)

The embed activates ONLY when every line below is signed.

- [x] **§A1 gate definition reconciled** per §3.1 — `tasks.md` line 78 §A1 row updated in this activation PR to reflect the reviewer-sign-off framing ("⛔ Held; cleared by the named visual-direction reviewer's sign-off on `visual-direction/README.md` (T010 + T011) — which is also the `/impeccable shape=pass` event").
- [ ] **P1–P6 all green** (load-context output saved to `coordination.md`). *(Self-validatable: P1 ✅ `docs/product.md` present; P2 ✅ `docs/DESIGN.md` present per box 4 below; P3 ✅ register=product in product.md line 5; P5 ✅ constitution v1.5.1 present. P4 — §A1 reviewer-named — and P6 — failing tests on the board — require the §A1 reviewer + Slice 0 commencement, hence this box stays unticked until those land.)*
- [ ] **§A1 reviewer named AND has accepted the role** of shape-brief approver per §3 (notification alone is insufficient — record explicit acceptance in `coordination.md`).
- [x] **`docs/DESIGN.md` present in canonical Stitch format** (renamed from `docs/design-system.md` in this activation PR per v0.4 changelog). Loader returns `hasDesign: true`. `specs/007-pos-visual-system/` retained as secondary reference.
- [x] **Embed scope ratified**: this preflight read, scope table (§1) confirmed, non-uses (§8) confirmed. Activation PR injects markers strictly within the §1 in-scope list (T010 / T173 / T290 / T360 / T450 / T512); no §8 non-use surface received a marker.
- [x] **Marker syntax (§4) referenced from `specs/008-.../tasks.md`** via a single sentence directly under the Status line — "Embed: `[IMPECCABLE shape\|craft\|polish]` markers on T010 / T173 / T290 / T360 / T450 / T512 delegate UI direction and polish to the `/impeccable` skill per `docs/impeccable-embed-preflight.md §4`."
- [x] **Constitution version pinned** at the bottom of this preflight (v1.5.1) matches `tasks.md` line 15 (v1.5.1).

Signed: ___________________ (embedder) · ___________________ (§A1 reviewer) · ___________________ (date)

---

**Constitution version pinned:** v1.5.1
**Last updated:** 2026-05-27 (v0.4 — activation discovery: design-system.md was already Stitch DESIGN.md; renamed in this activation PR)
**Owner of this preflight:** the embedder for 008. Promote to a general spec-kit rule only after 008 §A5 retrospects the embed.

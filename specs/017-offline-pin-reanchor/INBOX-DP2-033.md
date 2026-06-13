# INBOX — from DP-2 (033): confirm POS-Pulse response-validation mode

**From:** Data-Pulse-2 · **Re:** 033 `feat(033)` surface provider-neutral `user_id` on the POS operator response · **Date:** 2026-06-13 · **Status:** awaiting POS-Pulse answer

> This is an inbound cross-repo note from DP-2. It records ONE question for the POS-Pulse owner and does **not** change this spec, its `BLOCKER.md` status, `tasks.md`, or any code. Acting on it (re-pin, unblock) is POS-Pulse's decision.

## The one question

**Does POS-Pulse validate the DP-2 `PosOperatorSummary` response strictly or leniently?**

- **Lenient** (ignores unknown response fields) → no action needed from DP-2's side; the new field is transparently additive.
- **Strict** (validates against the pinned schema, rejecting unknown properties) → because `PosOperatorSummary` is declared `additionalProperties: false`, a strict validator pinned to the **old** schema will **reject** a response that now carries `user_id` — *even though POS does not read it yet*. In that case POS-Pulse must **re-pin to the new contract** (DP-2 `origin/main` `c5e1c5d`) at the same time it starts receiving the new field, i.e. the schema bump and the POS-Pulse pin update are a coordinated pair.

Please reply with **strict** or **lenient** (and, if strict, confirm the re-pin will accompany adoption).

## Why this question exists now (minimal context)

DP-2 shipped **033** (`feat(033)`, PR #567, squash `c5e1c5d` on `origin/main`, 2026-06-13): the provider-neutral §16 `user_id` (= DP-2 `users.id`) is now an **additive, `required`, `format: uuid`** field on the `PosOperatorSummary` operator block, alongside the retained `id` (= `clerk_user_id`, v1 bridge). It is present on every `signed_in` response (sign-in, manager/admin, takeover-confirm including idempotent replay) and is **not** encoded in the opaque envelope — it is a readable sibling field.

This is the exact "new DP-2 slice surfaces `user_id` on a POS-facing response" named in this spec's `BLOCKER.md` **Unblock criteria**. DP-2 raises only the validation-mode question above; whether/when to lift the 017 blocker and re-pin is POS-Pulse's call.

## Pointers (DP-2 side, for whoever picks this up)

- Contract schema: `packages/contracts/openapi/pos-operators.openapi.yaml` → `PosOperatorSummary` (now `required: [id, user_id, display_name, role, tenant_id, branch_id]`, `additionalProperties: false` retained).
- Merge commit: `c5e1c5d` (PR #567). Planning chain: PR #565 (`102934f`); SPECIFY: PR #564.
- DP-2 spec: `specs/033-pos-facing-user-id-surface/spec.md` (Status: IMPLEMENTED), which carries this same open cross-side input.

# POS Pulse Documentation

This directory is the public documentation entrypoint for POS Pulse, the
Windows desktop point-of-sale terminal for the SmartDataPulse pharmacy platform.
It is organized for product review, engineering onboarding, security review,
and hardware planning.

## Start Here

| Audience | Best first reads |
| --- | --- |
| Product and operations reviewers | [README](../README.md), [Hardware matrix](hardware-matrix.md), [POS shell spec](../specs/003-pos-ui-shell/spec.md) |
| Engineering reviewers | [Foundation plan](../specs/001-foundation/plan.md), [Terminal pairing plan](../specs/002-terminal-pairing/plan.md), [Operator session plan](../specs/004-operator-session/plan.md) |
| Security reviewers | [Constitution](../.specify/memory/constitution.md), [Operator security review](../specs/004-operator-session/security-review/s1-review.md), [Redaction evidence](../specs/004-operator-session/security-review/s1-redaction-evidence.md) |
| Integration reviewers | [Pairing HTTP contract](../specs/002-terminal-pairing/contracts/pairing-http.md), [Operator backend endpoints](../specs/004-operator-session/contracts/backend-endpoints.md), [API snapshot](../scripts/openapi-snapshot.json) |

## Documentation Map

| Document | Purpose |
| --- | --- |
| [Hardware matrix](hardware-matrix.md) | MVP hardware scope, tested-model registry, and update rules. |
| [Asset guide](assets/README.md) | Visual asset naming and style guidance for README and docs diagrams. |
| [Foundation quickstart](../specs/001-foundation/quickstart.md) | Clone-to-window developer onboarding for the secure Electron substrate. |
| [Terminal pairing quickstart](../specs/002-terminal-pairing/quickstart.md) | Pairing flow setup and verification guidance. |
| [POS UI shell plan](../specs/003-pos-ui-shell/plan.md) | Renderer shell, navigation, routes, and UI region strategy. |
| [Operator session spec](../specs/004-operator-session/spec.md) | Active feature requirements for operator identity and sessions. |
| [Bridge API contract](../specs/004-operator-session/contracts/bridge-api.md) | Canonical operator preload bridge surface. |

## Visual System

The README uses GitHub-renderable SVG and Mermaid:

- SVG assets provide a polished product-grade first impression.
- Mermaid keeps technical flow diagrams editable in Markdown.
- Icons live under `assets/icons/` and use a consistent terminal-oriented
  enterprise style.

## Documentation Rules

- Keep wording truthful to the POS terminal scope.
- Do not imply this repository owns the SaaS backend or dashboard.
- Preserve the secure Electron process boundary in any architecture docs.
- Treat the hardware matrix and constitution as higher authority than marketing
  language.

// 009-product-search-and-barcode-lookup — `src/main/catalogue/` module barrel.
//
// T001 (Phase 1 / Setup) creates the module directory + this barrel only.
// The catalogue main-process modules are added behind their slice gates and
// re-exported here as they land:
//   • S1 (§A1) — `catalogue-bridge.ts`   (session-gated `catalogue.*` skeleton)
//   • S2 (§A2) — `product-repo.ts`        (read-only barcode/SKU lookup)
//   • Foundational — `normalize.ts`       (Arabic/English folding contract)
//   • S3       — `search.ts`              (folded substring search)
//   • S4 (§A1) — `resolve-item-ref.ts`    (production R7 resolver → 005 seam)
//
// No implementation ships in Setup (tasks.md: "`/speckit-plan` wrote NO
// source"). `export {}` keeps this a module rather than a global script until
// the first real export exists.
export {};

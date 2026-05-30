// 009-product-search-and-barcode-lookup — `src/renderer/ui/catalogue/` barrel.
//
// T002 (Phase 1 / Setup) creates the component directory + this barrel only.
// The catalogue renderer components are added behind their slice gates and
// re-exported here as they land:
//   • S1 (§A1) — layout-only shells: `ProductSearchInput`, `ScanCaptureField`,
//                `SearchResultList`, `ProductConfirmPanel`, `NotFoundState`,
//                `CatalogueUnavailableState`, `AmbiguousBarcodeState`
//   • S3       — `SearchResultRow` + keyboard-navigable result list
//   • S4 (§A1) — confirm-first add flow + controlled/Rx flag surfacing
//
// No component ships in Setup. `export {}` keeps this a module rather than a
// global script until the first real export exists.
export {};

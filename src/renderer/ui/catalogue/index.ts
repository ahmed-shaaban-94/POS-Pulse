// 009-product-search-and-barcode-lookup — `src/renderer/ui/catalogue/` barrel.
//
// Slice S1 (T018) lands the layout-only component shells, one per S0
// contact-sheet surface. Behaviour (store binding, keyboard nav, add flow,
// controlled/Rx surfacing) is wired in S3/S4.
export { ProductSearchInput } from './ProductSearchInput.js';
export type { ProductSearchInputProps } from './ProductSearchInput.js';
export { ScanCaptureField } from './ScanCaptureField.js';
export type { ScanCaptureFieldProps } from './ScanCaptureField.js';
export { SearchResultList } from './SearchResultList.js';
export type { SearchResultListProps } from './SearchResultList.js';
export { ProductConfirmPanel } from './ProductConfirmPanel.js';
export type { ProductConfirmPanelProps } from './ProductConfirmPanel.js';
export { NotFoundState } from './NotFoundState.js';
export type { NotFoundStateProps } from './NotFoundState.js';
export { CatalogueUnavailableState } from './CatalogueUnavailableState.js';
export { AmbiguousBarcodeState } from './AmbiguousBarcodeState.js';
export type { AmbiguousBarcodeStateProps } from './AmbiguousBarcodeState.js';
// S4b — confirm-first add controller + shared controlled/Rx surfacing badge.
export { CatalogueAddController } from './CatalogueAddController.js';
export type { CatalogueAddControllerProps } from './CatalogueAddController.js';
export { ControlledFlags } from './ControlledFlags.js';

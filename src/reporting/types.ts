/**
 * @fileoverview
 * Types that define the recon scan report contract.
 *
 * @remarks
 * The recon report is the primary output of the scanner and the input to downstream
 * processing such as Page Model transformation and code generation.
 */

/**
 * Supported element types produced by the recon scanner.
 *
 * @remarks
 * These are intentionally broad categories to keep the scanner framework-agnostic.
 */
export type ReconElementType = "button" | "link" | "input" | "select" | "textarea" | "other";

/**
 * Represents a scanned element and the metadata needed for automation scoping.
 *
 * @remarks
 * Fields are best-effort. Not all pages will provide strong accessibility signals,
 * and not all elements will have stable selectors.
 */
export type ReconElement = {
  type: ReconElementType;
  tagName: string;

  // identity / automation signals
  role?: string;
  accessibleName?: string;
  labelText?: string;
  testId?: string;

  // attributes
  text?: string;
  id?: string;
  name?: string;
  href?: string;
  placeholder?: string;
  ariaLabel?: string;
  disabled?: boolean;
  ariaDisabled?: boolean;
  typeAttr?: string;
  value?: string;

  // selector hints
  css?: string;
  xpath?: string;
};

/**
 * Represents a complete recon scan output for a single page URL.
 */
export type ReconReport = {
  url: string;
  scannedAt: string; // ISO date
  counts: Record<ReconElementType, number>;
  elements: ReconElement[];
};

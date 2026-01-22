/**
 * @fileoverview
 * Framework-agnostic page model types used for automation code generation.
 *
 * @remarks
 * This model is intentionally independent of any specific automation framework
 * (Playwright, Selenium, Cypress, etc.). It is derived from a recon scan report
 * and provides a stable contract for generators.
 */

/**
 * Represents a normalized, framework-agnostic classification of an element.
 *
 * @remarks
 * This is *not* a DOM tag name. It is a semantic "kind" used by generators to
 * decide what code to emit (Page Object, BDD steps, etc.).
 */
export type ElementKind =
  | "button"
  | "link"
  | "textbox"
  | "checkbox"
  | "radio"
  | "select"
  | "textarea"
  | "other";

/**
 * Represents a framework-agnostic locator hint.
 *
 * @remarks
 * Locator hints are ordered by preference (best first) when attached to an element.
 * Generators should attempt the first viable strategy supported by their framework.
 */
export type LocatorHint =
  | { strategy: "testId"; value: string }
  | { strategy: "role"; role: string; name?: string }
  | { strategy: "label"; value: string }
  | { strategy: "placeholder"; value: string }
  | { strategy: "css"; value: string }
  | { strategy: "xpath"; value: string };

/**
 * Represents a single UI element in a framework-agnostic page model.
 */
export type ElementModel = {
  // stable-ish internal id for generation
  id: string;                 
  kind: ElementKind;

  // Best-effort human readable name (used in codegen + feature tables)
  name?: string;

  // What we observed (useful for docs/debug)
  tagName?: string;
  role?: string;
  href?: string;

  // Locator hints sorted by preference (best first)
  locators: LocatorHint[];

  // Optional flags that help generators decide what to emit
  flags?: {
    disabled?: boolean;
    ariaDisabled?: boolean;
  };
};

/**
 * Represents the framework-agnostic model for a scanned page.
 */
export type PageModel = {
  url: string;
  domain: string;
  scannedAt: string;

  // Optional metadata (safe, non-business)
  title?: string;

  elements: ElementModel[];
};
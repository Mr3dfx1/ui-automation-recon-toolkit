/**
 * @fileoverview
 * Builds a framework-agnostic {@link PageModel} from a recon scan report.
 */
import { PageModel, ElementKind, ElementModel, LocatorHint } from "./pageModel";
import { ReconReport, ReconElement } from "../reporting/types";

/**
 * Extracts a domain from a URL.
 *
 * @param url - The URL to parse.
 * @returns The hostname without a leading `www.` prefix.
 */
function domainFromUrl(url: string): string {
  const u = new URL(url);
  return u.hostname.replace(/^www\./, "");
}

/**
 * Normalizes whitespace by trimming and collapsing runs of whitespace.
 *
 * @param s - Input string.
 * @returns Normalized string.
 */
function normalizeWhitespace(s: string): string {
  return s.trim().replace(/\s+/g, " ");
}

/**
 * Produces a safe, short "display name" string for use in tables and code generation.
 *
 * @param s - Input string or undefined.
 * @returns A cleaned, length-limited string or undefined if empty.
 */
function safeName(s?: string): string | undefined {
  if (!s) return undefined;
  const v = normalizeWhitespace(s);
  return v.length ? v.slice(0, 80) : undefined;
}

/**
 * Maps a recon element to a framework-agnostic {@link ElementKind}.
 *
 * @remarks
 * This mapping is intentionally conservative. If the recon report does not capture
 * sufficient detail (e.g., input type), generators should not assume checkbox/radio.
 *
 * @param el - Recon element.
 * @returns Framework-agnostic element kind.
 */
function kindFromRecon(el: ReconElement): ElementKind {
  // ReconElementType: "button" | "link" | "input" | "select" | "textarea" | "other"
  switch (el.type) {
    case "button":
      return "button";
    case "link":
      return "link";
    case "input":
      // we can’t reliably infer checkbox/radio without input type in report,
      // so we treat as textbox for now (future enhancement: capture inputType)
      return "textbox";
    case "select":
      return "select";
    case "textarea":
      return "textarea";
    default:
      return "other";
  }
}

/**
 * Builds a best-effort human-friendly name from available signals.
 *
 * @remarks
 * Preference order (best first): accessibleName → labelText → ariaLabel → name → id → text.
 *
 * @param el - Recon element.
 * @returns Best-effort name or undefined.
 */
function buildName(el: ReconElement): string | undefined {
  // Preference order for a “human name”
  return (
    safeName((el as any).accessibleName) ||
    safeName((el as any).labelText) ||
    safeName(el.ariaLabel) ||
    safeName(el.name) ||
    safeName(el.id) ||
    safeName(el.text)
  );
}

/**
 * Builds an ordered list of locator hints from the recon element.
 *
 * @remarks
 * Preference order (best first): testId → role/name → label → placeholder → css → xpath.
 * Generators should select the first compatible hint for their framework.
 *
 * @param el - Recon element.
 * @returns Ordered locator hints.
 */
function buildLocators(el: ReconElement): LocatorHint[] {
  const locators: LocatorHint[] = [];

  const testId = (el as any).testId as string | undefined;
  const role = (el as any).role as string | undefined;
  const accessibleName = (el as any).accessibleName as string | undefined;
  const labelText = (el as any).labelText as string | undefined;

  if (testId) locators.push({ strategy: "testId", value: testId });

  // Use role even if name is missing; some generators can still use role alone
  if (role) locators.push({ strategy: "role", role, name: safeName(accessibleName) });

  if (labelText) locators.push({ strategy: "label", value: safeName(labelText)! });

  if (el.placeholder) locators.push({ strategy: "placeholder", value: el.placeholder });

  if (el.css) locators.push({ strategy: "css", value: el.css });
  if ((el as any).xpath) locators.push({ strategy: "xpath", value: (el as any).xpath });

  // Ensure no empty strings sneak in
  return locators.filter((l) => {
    if (l.strategy === "role") return Boolean(l.role);
    if ("value" in l) return Boolean(l.value);
    return true;
  });
}

/**
 * Builds a stable-ish identifier used for deterministic code generation.
 *
 * @remarks
 * This is not intended to be a globally stable ID across all scans, but it aims to
 * minimize diffs between scans of the same page by using strong element signals first.
 *
 * @param el - Recon element.
 * @param index - Element index (fallback uniqueness).
 * @returns A slug-based ID.
 */
function stableElementId(el: ReconElement, index: number): string {
  // stable-ish internal id: kind + name/id fallback + index
  const base =
    (el as any).testId ||
    el.id ||
    el.name ||
    el.ariaLabel ||
    el.text ||
    el.tagName ||
    `element-${index}`;

  const slug = normalizeWhitespace(String(base))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);

  return `${el.type}-${slug || "unnamed"}-${index}`;
}

/**
 * Builds a {@link PageModel} from a recon scan report.
 *
 * @param report - Recon scan report.
 * @param title - Optional page title if captured by the scanner.
 * @returns A framework-agnostic page model suitable for code generation.
 *
 * @example
 * ```ts
 * const model = buildPageModel(report);
 * console.log(model.domain);
 * ```
 */
export function buildPageModel(report: ReconReport, title?: string): PageModel {
  const domain = domainFromUrl(report.url);

  const elements: ElementModel[] = report.elements.map((el, index) => ({
    id: stableElementId(el, index),
    kind: kindFromRecon(el),
    name: buildName(el),
    tagName: el.tagName,
    role: (el as any).role,
    href: el.type === "link" ? (el as any).href : undefined,
    locators: buildLocators(el),
    flags: {
      disabled: (el as any).disabled,
      ariaDisabled: (el as any).ariaDisabled,
    },
  }));

  return {
    url: report.url,
    domain,
    scannedAt: report.scannedAt,
    title,
    elements,
  };
}
/**
 * @fileoverview
 * Page scanner that performs a recon pass against a URL using Playwright.
 *
 * @remarks
 * The scanner launches Chromium, navigates to the target URL, and discovers
 * interactable elements using semantic and accessibility signals (native tags,
 * ARIA roles, focusability, click handlers, etc.). Output is returned as a
 * {@link ReconReport} suitable for reporting and downstream generation.
 */
import { chromium } from "@playwright/test";
import { ReconReport, ReconElementType, ReconElement } from "../reporting/types";

/**
 * Represents the raw element payload produced inside the page context.
 *
 * @remarks
 * This structure is created in `page.evaluate()` and then mapped to
 * {@link ReconElement} in Node context. Fields are best-effort and may be
 * undefined depending on the page.
 */
type RawEl = {
  tag: string;
  role?: string;
  typeAttr?: string;
  value?: string;
  text?: string;
  id?: string;
  name?: string;
  href?: string;
  placeholder?: string;
  ariaLabel?: string;
  ariaDisabled?: boolean;
  disabled?: boolean;
  testId?: string;
  labelText?: string;
  accessibleName?: string;
  css?: string;
  xpath?: string;
};

const INTERACTIVE_ROLES = new Set([
  "button",
  "link",
  "textbox",
  "checkbox",
  "radio",
  "switch",
  "combobox",
  "listbox",
  "option",
  "menuitem",
  "tab",
  "slider",
  "spinbutton",
]);

/**
 * Normalizes a {@link RawEl} into a {@link ReconElementType}.
 *
 * @remarks
 * Uses a combination of ARIA role and DOM tag semantics. This mapping is
 * intentionally conservative and avoids inferring business intent.
 *
 * @param raw - Raw element payload.
 * @returns Normalized element type.
 */
function normalizeType(raw: RawEl): ReconElementType {
  const role = raw.role?.toLowerCase();
  const tag = raw.tag.toLowerCase();
  const inputType = raw.typeAttr?.toLowerCase();

  if (role && INTERACTIVE_ROLES.has(role)) {
    // map some roles to our simplified types
    if (role === "textbox") return "input";
    if (role === "combobox" || role === "listbox") return "select";
    if (role === "link") return "link";
    if (role === "button") return "button";
    return "other";
  }

  if (tag === "button") return "button";
  if (tag === "a" && raw.href) return "link";
  if (tag === "select") return "select";
  if (tag === "textarea") return "textarea";
  if (tag === "input") {
    if (inputType === "button" || inputType === "submit" || inputType === "reset") return "button";
    // Keep these as "input" for now, but having typeAttr saved lets PageModel/codegen decide later
    return "input";
  }

  // generic focusable/clickable widgets
  return "other";
}

/**
 * Scans a URL and returns a {@link ReconReport} of discovered interactable elements.
 *
 * @remarks
 * - Navigates to the page using `waitUntil: "domcontentloaded"`.
 * - Discovers candidate elements using semantic and accessibility signals.
 * - Captures best-effort selector hints (CSS and XPath).
 * - Captures automation-relevant metadata such as role, label text, accessible name,
 *   test id attributes, and link href values.
 *
 * @param url - Target page URL (http/https).
 * @param headed - Whether to launch the browser in headed mode.
 * @returns A recon report containing the scanned elements and aggregate counts.
 */
export async function scanUrl(url: string, headed: boolean): Promise<ReconReport> {
  const browser = await chromium.launch({ headless: !headed });
  const page    = await browser.newPage();

  try {
    await page.goto(url, { waitUntil: "domcontentloaded" });

    const rawElements = await page.evaluate((): RawEl[] => {
      const interactiveRoles = new Set([
        "button",
        "link",
        "textbox",
        "checkbox",
        "radio",
        "switch",
        "combobox",
        "listbox",
        "option",
        "menuitem",
        "tab",
        "slider",
        "spinbutton",
      ]);

      /**
       * Determines whether an element is visually and semantically visible.
       *
       * @remarks
       * This check is stricter than simple DOM presence. It filters out elements that:
       * - are hidden via CSS (`display: none`, `visibility: hidden`, `opacity: 0`)
       * - have zero rendered size
       * - are marked as hidden or `aria-hidden`
       *
       * Elements failing this check are excluded from automation consideration.
       *
       * @param el - DOM element to evaluate.
       * @returns `true` if the element is considered visible; otherwise `false`.
       */
      function isVisible(el: Element): boolean {
        const e = el as HTMLElement;
        const style = window.getComputedStyle(e);
        if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return false;
        if ((e as any).hidden) return false;
        const rect = e.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return false;
        // aria-hidden can hide from accessibility tree; often should not be automated
        if (e.getAttribute("aria-hidden") === "true") return false;
        return true;
      }

      /**
       * Determines whether an element is disabled via native or ARIA mechanisms.
       *
       * @remarks
       * Both native `disabled` attributes and `aria-disabled="true"` are captured
       * to support automation decisions and reporting.
       *
       * @param el - DOM element to evaluate.
       * @returns An object containing native and ARIA disabled state flags.
       */
      function isDisabled(el: Element): { disabled?: boolean; ariaDisabled?: boolean } {
        const e = el as HTMLElement;
        const disabled = (e as any).disabled === true || e.getAttribute("disabled") !== null;
        const ariaDisabled = e.getAttribute("aria-disabled") === "true";
        return { disabled, ariaDisabled };
      }

      /**
       * Determines whether an element should be considered an automation candidate.
       *
       * @remarks
       * An element is considered a candidate if it:
       * - is visible
       * - is natively interactive (button, input, select, textarea, link, etc.)
       * - has an interactive ARIA role
       * - is focusable via tabindex
       * - has click handlers or editable content
       *
       * This heuristic intentionally errs on the side of inclusion for discovery.
       *
       * @param el - DOM element to evaluate.
       * @returns `true` if the element should be included in the recon scan.
       */
      function isCandidate(el: Element): boolean {
        const e = el as HTMLElement;
        if (!isVisible(e)) return false;

        const tag = e.tagName.toLowerCase();
        const role = (e.getAttribute("role") || "").toLowerCase();
        const tabindex = e.getAttribute("tabindex");
        const hasTabindex = tabindex !== null && !Number.isNaN(Number(tabindex)) && Number(tabindex) >= 0;

        const hasClickHandler =
          typeof (e as any).onclick === "function" ||
          e.getAttribute("onclick") !== null;

        const contentEditable: boolean = e.getAttribute("contenteditable") === "true";

        const nativeInteractive =
          tag === "button" ||
          (tag === "a" && e.getAttribute("href") !== null) ||
          tag === "input" ||
          tag === "select" ||
          tag === "textarea" ||
          (tag === "summary" && e.parentElement?.tagName.toLowerCase() === "details");

        const ariaInteractive = role !== "" && interactiveRoles.has(role);

        return nativeInteractive || ariaInteractive || hasTabindex || hasClickHandler || contentEditable;
      }

      /**
       * Extracts normalized text content from an element.
       *
       * @remarks
       * Text is trimmed, whitespace-normalized, and truncated to avoid excessively
       * large values in reports.
       *
       * @param el - DOM element to extract text from.
       * @returns Normalized text content or `undefined` if empty.
       */
      function getText(el: Element): string | undefined {
        const txt = (el.textContent || "").trim().replace(/\s+/g, " ");
        return txt ? txt.slice(0, 200) : undefined;
      }

      /**
       * Escapes a string for safe use in a CSS selector.
       *
       * @param value - Raw attribute value.
       * @returns CSS-escaped string.
       */
      function cssEscape(value: string): string {
        return value.replace(/(["\\.#:[\]])/g, "\\$1");
      }

      /**
       * Generates a best-effort CSS selector for an element.
       *
       * @remarks
       * Selector priority:
       * 1. Test ID attributes
       * 2. DOM `id`
       * 3. `name` attribute
       * 4. `aria-label`
       * 5. Tag-only fallback
       *
       * Selectors are not guaranteed to be unique, but are intended to be
       * automation-friendly and stable where possible.
       *
       * @param el - DOM element to generate a selector for.
       * @returns A CSS selector string.
       */
      function bestCss(el: Element): string {
        const e = el as HTMLElement;
        const tag = e.tagName.toLowerCase();

        const testId =
          e.getAttribute("data-testid") ||
          e.getAttribute("data-test") ||
          e.getAttribute("data-test-id");
        if (testId) return `[data-testid="${cssEscape(testId)}"], [data-test="${cssEscape(testId)}"], [data-test-id="${cssEscape(testId)}"]`;

        const id = e.getAttribute("id");
        if (id) return `#${cssEscape(id)}`;

        const name = e.getAttribute("name");
        if (name) return `${tag}[name="${cssEscape(name)}"]`;

        const ariaLabel = e.getAttribute("aria-label");
        if (ariaLabel) return `${tag}[aria-label="${cssEscape(ariaLabel)}"]`;

        // fallback: tag only (least specific but safe)
        return tag;
      }

      /**
       * Generates a best-effort XPath selector for an element.
       *
       * @remarks
       * Prefers ID-based XPath when available. Otherwise, constructs a positional
       * XPath based on the element's location in the DOM tree.
       *
       * This selector is intended as a fallback and may be brittle across DOM changes.
       *
       * @param el - DOM element to generate an XPath for.
       * @returns An XPath selector string.
       */
      function xpathFor(el: Element): string {
        const e = el as HTMLElement;

        const id = e.getAttribute("id");
        if (id) return `//*[@id="${id}"]`;

        // Basic absolute-ish XPath with sibling indexes
        const parts: string[] = [];
        let node: Element | null = e;
        while (node && node.nodeType === Node.ELEMENT_NODE) {
          const tag = node.tagName.toLowerCase();
          let index = 1;
          let sibling = node.previousElementSibling;
          while (sibling) {
            if (sibling.tagName.toLowerCase() === tag) index++;
            sibling = sibling.previousElementSibling;
          }
          parts.unshift(`${tag}[${index}]`);
          node = node.parentElement;
        }
        return "/" + parts.join("/");
      }

      /**
       * Finds label text associated with a form control.
       *
       * @remarks
       * Supports both:
       * - `<label for="...">` associations
       * - wrapped label patterns
       *
       * @param el - Form control element.
       * @returns Normalized label text or `undefined` if not found.
       */
      function findAssociatedLabelText(el: Element): string | undefined {
        const e = el as HTMLElement;
        const id = e.getAttribute("id");
        if (id) {
          const lbl = document.querySelector(`label[for="${CSS.escape(id)}"]`);
          const t = lbl?.textContent?.trim();
          if (t) return t.replace(/\s+/g, " ").slice(0, 200);
        }
        // wrapped label
        const parentLabel = e.closest("label");
        const t2 = parentLabel?.textContent?.trim();
        if (t2) return t2.replace(/\s+/g, " ").slice(0, 200);
        return undefined;
      }

      /**
       * Computes a best-effort accessible name for an element.
       *
       * @remarks
       * Naming priority:
       * 1. `aria-label`
       * 2. Associated label text
       * 3. `value` attribute for input buttons
       * 4. `alt` attribute
       * 5. Visible text content
       *
       * This is an approximation intended for automation discovery, not a full
       * accessibility tree implementation.
       *
       * @param el - DOM element to evaluate.
       * @returns Best-effort accessible name or `undefined`.
       */
      function accessibleName(el: Element): string | undefined {
        const e   = el as HTMLElement;
        const tag = e.tagName.toLowerCase();

        // best-effort accessible name approximation:
        const aria = e.getAttribute("aria-label");
        if (aria) return aria;

        const label = findAssociatedLabelText(e);
        if (label) return label;

        // For input buttons, "value" is often the visible label
        if (tag === "input") {
          const t = (e.getAttribute("type") || "text").toLowerCase();
          if (t === "submit" || t === "button" || t === "reset") {
            const v = e.getAttribute("value");
            if (v) return v;
          }
        }

        const alt = e.getAttribute("alt");
        if (alt) return alt;

        return getText(e);
      }

      const all = Array.from(document.querySelectorAll("*")).filter(isCandidate);

      // De-dupe: if our selection returns massive set via "*" candidate logic,
      // keep it manageable by filtering out containers with no useful signals.
      const filtered = all.filter((el) => {
        const e   = el as HTMLElement;
        const tag = e.tagName.toLowerCase();
        if (tag === "div" || tag === "span") {
          const role = e.getAttribute("role");
          const tabindex = e.getAttribute("tabindex");
          const hasClickHandler = typeof (e as any).onclick === "function" || e.getAttribute("onclick") !== null;
          return Boolean(role || tabindex || hasClickHandler);
        }
        return true;
      });

      return filtered.map((el) => {
        const e        = el as HTMLElement;
        const tag      = e.tagName.toLowerCase();
        const role     = e.getAttribute("role") || undefined;
        const typeAttr = tag === "input" ? (e.getAttribute("type") || "text") : undefined;

        const { disabled, ariaDisabled } = isDisabled(e);

        const testId =
          e.getAttribute("data-testid")  ||
          e.getAttribute("data-test")    ||
          e.getAttribute("data-test-id") ||
          undefined;

        const href        = tag === "a" ? e.getAttribute("href") || undefined : undefined;
        const placeholder = tag === "input" || tag === "textarea" ? e.getAttribute("placeholder") || undefined : undefined;
        const value       = tag === "input" ? e.getAttribute("value") || undefined : undefined;
        const labelText   = findAssociatedLabelText(e);

        return {
          tag,
          role,
          typeAttr,
          value,
          text: getText(e),
          id: e.getAttribute("id") || undefined,
          name: e.getAttribute("name") || undefined,
          href,
          placeholder,
          ariaLabel: e.getAttribute("aria-label") || undefined,
          ariaDisabled,
          disabled,
          testId,
          labelText,
          accessibleName: accessibleName(e),
          css: bestCss(e),
          xpath: xpathFor(e),
        };
      });
    });

    // Convert RawEl[] → ReconElement[]
    const elements: ReconElement[] = rawElements.map((r) => ({
      type: normalizeType(r),
      tagName: r.tag,
      typeAttr: r.typeAttr,
      value: r.value,
      text: r.text,
      id: r.id,
      name: r.name,
      href: r.tag === "a" ? r.href : undefined,
      ariaLabel: r.ariaLabel,
      placeholder: r.placeholder,
      css: r.css,
      xpath: r.xpath,
      role: r.role,
      testId: r.testId,
      accessibleName: r.accessibleName,
      labelText: r.labelText,
    }));

    const counts = elements.reduce((acc, e) => {
      acc[e.type] = (acc[e.type] ?? 0) + 1;
      return acc;
    }, {} as Record<ReconElementType, number>);

    // Ensure all keys exist
    const allTypes: ReconElementType[]  = ["button", "link", "input", "select", "textarea", "other"];
    for (const t of allTypes) counts[t] = counts[t] ?? 0;

    return {
      url,
      scannedAt: new Date().toISOString(),
      counts,
      elements,
    };
  } finally {
    await browser.close();
  }
}

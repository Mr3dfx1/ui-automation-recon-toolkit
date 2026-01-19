import { chromium } from "@playwright/test";
import { ReconReport, ReconElementType, ReconElement } from "../reporting/types";

type RawEl = {
  tag: string;
  role?: string;
  typeAttr?: string;
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
  if (tag === "input") return "input";

  // generic focusable/clickable widgets
  return "other";
}

export async function scanUrl(url: string, headed: boolean): Promise<ReconReport> {
  const browser = await chromium.launch({ headless: !headed });
  const page = await browser.newPage();

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

      function isDisabled(el: Element): { disabled?: boolean; ariaDisabled?: boolean } {
        const e = el as HTMLElement;
        const disabled = (e as any).disabled === true || e.getAttribute("disabled") !== null;
        const ariaDisabled = e.getAttribute("aria-disabled") === "true";
        return { disabled, ariaDisabled };
      }

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

      function getText(el: Element): string | undefined {
        const txt = (el.textContent || "").trim().replace(/\s+/g, " ");
        return txt ? txt.slice(0, 200) : undefined;
      }

      function cssEscape(value: string): string {
        return value.replace(/(["\\.#:[\]])/g, "\\$1");
      }

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

      function accessibleName(el: Element): string | undefined {
        const e = el as HTMLElement;
        // best-effort accessible name approximation:
        return (
          e.getAttribute("aria-label") ||
          findAssociatedLabelText(e) ||
          (e.getAttribute("alt") || undefined) ||
          getText(e)
        );
      }

      const all = Array.from(document.querySelectorAll("*")).filter(isCandidate);

      // De-dupe: if our selection returns massive set via "*" candidate logic,
      // keep it manageable by filtering out containers with no useful signals.
      const filtered = all.filter((el) => {
        const e = el as HTMLElement;
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
        const e = el as HTMLElement;
        const tag = e.tagName.toLowerCase();
        const role = e.getAttribute("role") || undefined;
        const typeAttr = tag === "input" ? (e.getAttribute("type") || "text") : undefined;

        const { disabled, ariaDisabled } = isDisabled(e);

        const testId =
          e.getAttribute("data-testid") ||
          e.getAttribute("data-test") ||
          e.getAttribute("data-test-id") ||
          undefined;

        const href = tag === "a" ? e.getAttribute("href") || undefined : undefined;

        const placeholder =
          tag === "input" || tag === "textarea" ? e.getAttribute("placeholder") || undefined : undefined;

        const labelText = findAssociatedLabelText(e);

        return {
          tag,
          role,
          typeAttr,
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
    const allTypes: ReconElementType[] = ["button", "link", "input", "select", "textarea", "other"];
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

/**
 * @fileoverview
 * Unit tests for {@link buildPageModel}.
 *
 * @remarks
 * These tests validate the deterministic transformation rules from a recon scan
 * report to the framework-agnostic Page Model used for code generation.
 *
 * These tests intentionally avoid browser dependencies; they do not run Playwright.
 */

import { describe, it, expect } from "vitest";
import { buildPageModel } from "../src/model/buildPageModel";
import type { ReconReport } from "../src/reporting/types";

/**
 * Builds a baseline {@link ReconReport} object suitable for unit testing.
 *
 * @remarks
 * Using a factory keeps tests focused on the specific behavior under test while
 * providing valid defaults for required fields.
 *
 * @param overrides - Partial overrides applied on top of the baseline report.
 * @returns A complete {@link ReconReport} object.
 */
function baseReport(overrides: Partial<ReconReport> = {}): ReconReport {
  return {
    url: "https://www.example.com",
    scannedAt: "2026-01-18T00:00:00.000Z",
    counts: { button: 0, link: 0, input: 0, select: 0, textarea: 0, other: 0 },
    elements: [],
    ...overrides,
  };
}

describe("buildPageModel", () => {
  it("extracts domain without leading www", () => {
    const model = buildPageModel(baseReport({ url: "https://www.example.com" }));
    expect(model.domain).toBe("example.com");
  });

  it("maps recon element types to framework-agnostic kinds", () => {
    const report = baseReport({
      url: "https://www.example.com",
      counts: { button: 1, link: 1, input: 1, select: 1, textarea: 1, other: 1 },
      elements: [
        { type: "input", tagName: "input", css: "input" } as any,
        { type: "button", tagName: "button", css: "button" } as any,
        { type: "link", tagName: "a", css: "a", href: "/x" } as any,
        { type: "select", tagName: "select", css: "select" } as any,
        { type: "textarea", tagName: "textarea", css: "textarea" } as any,
        { type: "other", tagName: "div", css: "div" } as any,
      ],
    });

    const model = buildPageModel(report);
    expect(model.elements.map((e) => e.kind)).toEqual([
      "textbox",
      "button",
      "link",
      "select",
      "textarea",
      "other",
    ]);
  });

  it("orders locator hints by preference (testId → role → label → placeholder → css → xpath)", () => {
    const report = baseReport({
      url: "https://www.example.com",
      counts: { button: 0, link: 0, input: 1, select: 0, textarea: 0, other: 0 },
      elements: [
        {
          type: "input",
          tagName: "input",
          testId: "zip",
          role: "textbox",
          accessibleName: "Zip Code",
          labelText: "Zip Code",
          placeholder: "Zip Code",
          css: 'input[name="zip"]',
          xpath: '//*[@id="zip"]',
        } as any,
      ],
    });

    const model = buildPageModel(report);
    expect(model.elements[0].locators.map((l) => l.strategy)).toEqual([
      "testId",
      "role",
      "label",
      "placeholder",
      "css",
      "xpath",
    ]);
  });

  it("derives a best-effort element name with correct precedence", () => {
    const report = baseReport({
      url: "https://www.example.com",
      counts: { button: 1, link: 0, input: 0, select: 0, textarea: 0, other: 0 },
      elements: [
        {
          type: "button",
          tagName: "button",
          accessibleName: "Primary CTA",
          labelText: "Label Should Lose",
          ariaLabel: "ARIA Should Lose",
          id: "id-should-lose",
          text: "Text Should Lose",
          css: "button",
        } as any,
      ],
    });

    const model = buildPageModel(report);
    expect(model.elements[0].name).toBe("Primary CTA");
  });
});
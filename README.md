# ui-automation-recon-toolkit
> 🚧 This project is under active development. Initial MVP focuses on DOM scanning and locator generation.


**TypeScript + Playwright toolkit for UI automation discovery.**  
Scans a target URL to identify interactable elements and generates Playwright-ready locators, CSS selectors, and XPath with stability insights. Built to accelerate automation scoping and reduce flaky tests.

---

## Why this exists

Modern UI automation often fails not because of tooling, but because of poor selector strategy and incomplete UI discovery.

This project explores how Playwright’s DOM and accessibility capabilities can be used to:
- Quickly understand an unfamiliar UI
- Recommend stable, automation-friendly locators
- Shorten time-to-coverage for new or legacy applications

It is intentionally built as automation tooling, not just test scripts.

---

## Core Features (Planned / In Progress)

- Load a target URL using Playwright
- Discover interactable UI elements (buttons, links, inputs, selects, etc.)
- Extract accessibility roles and names where available
- Generate recommended Playwright locators (role/label/test-id first)
- Provide fallback CSS selectors and XPath
- Output structured reports (JSON, HTML)


---

## Tech Stack

- TypeScript  
- Playwright  
- Node.js  

---

## Example Use Case

```bash
recon scan https://example.com

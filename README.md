# ui-automation-recon-toolkit
> 🚧 This project is under active development. The current MVP focuses on UI discovery, modeling, and automation-oriented analysis.

**TypeScript + Playwright toolkit for UI automation discovery and scaffolding.**  
Scans a target URL to identify interactable elements, analyzes accessibility and selector signals, and produces structured models designed to accelerate automation setup and reduce flaky tests.

---

## Why this exists

UI automation often moves slowly at the beginning—not because tests are hard to write, but because the **initial automation setup phase is expensive**.

Before a single meaningful test can be written, teams typically need to:
- Explore an unfamiliar UI
- Identify which elements are automation-worthy
- Decide on stable selector strategies
- Create page objects or models
- Scaffold feature files and step definitions
- Wire everything into a framework

This project exists to **accelerate that entire lifecycle**.

By combining Playwright’s DOM and accessibility capabilities with structured modeling and generation, this toolkit aims to:
- Rapidly discover automation-relevant UI elements
- Surface stable, automation-friendly selectors
- Produce structured reports and models that can be reused
- Generate starter automation artifacts (page objects, features, steps)
- Reduce the manual, error-prone setup work that slows teams down

It is intentionally built as **automation tooling**, not just test scripts.

---

## How it works (High-level)

The toolkit is structured as a **pipeline**, not a traditional test suite:

1. **Scan**  
   Uses Playwright to load a page and discover interactable elements based on:
   - Native semantics (buttons, inputs, links, etc.)
   - Accessibility roles and names
   - Focusability and interaction signals

2. **Model**  
   Transforms raw scan output into a **framework-agnostic Page Model** that:
   - Normalizes element types
   - Prioritizes locator strategies
   - Provides stable, deterministic metadata for generation

3. **Generate (in progress)**  
   The Page Model is designed to support future generation of:
   - Page Objects
   - BDD feature files
   - Step definitions
   - Framework-specific automation scaffolding

---

## Core Features

### Implemented
- CLI-based scanning via `scan` command
- Playwright-powered DOM discovery
- Detection of interactable UI elements
- Extraction of accessibility signals:
  - ARIA role
  - accessible name
  - associated label text
- Capture of automation-relevant metadata:
  - test IDs
  - link targets (href)
  - placeholders
- Generation of selector hints (ordered by stability):
  - test-id
  - role/name
  - CSS
  - XPath
- Timestamped JSON recon reports
- Framework-agnostic Page Model
- Unit tests protecting transformation and modeling logic

### Planned / In Progress
- Code generation from the Page Model
  - Playwright Page Objects
  - BDD feature files
  - Step definition scaffolding
- Additional output formats (HTML summaries, etc.)
- Support for multiple automation frameworks

---

## CLI Usage

The CLI is currently invoked via the npm script defined in `package.json`.

### Scan a page
```bash
npm run recon -- scan https://example.com

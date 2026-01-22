/**
 * @fileoverview
 * Vitest configuration for unit testing.
 *
 * @remarks
 * These tests are intended to validate deterministic, framework-agnostic logic
 * (e.g., report → model transformation and generation rules). They run in a Node
 * environment and do not launch a browser.
 */
import { defineConfig } from "vitest/config";

/**
 * Vitest configuration object.
 *
 * @remarks
 * - Uses the Node test environment.
 * - Discovers tests under 'tests/**//*.spec.ts'
 * - Keeps the test surface small and predictable for CI and local development.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.spec.ts"]
  }
});
#!/usr/bin/env node
/**
 * @fileoverview
 * CLI entry point for the UI Automation Recon Toolkit.
 *
 * @remarks
 * This module defines and configures the root `recon` command using Commander.
 * It is responsible for wiring subcommands and parsing process arguments when
 * executed as a Node.js CLI.
 */
import { Command } from "commander";
import { registerScanCommand } from "./commands/scan";

/**
 * Builds and configures the root CLI command.
 *
 * @remarks
 * This function is intentionally separated from execution to allow:
 * - programmatic invocation (e.g., tests)
 * - easier extension with additional subcommands
 * - clearer separation between configuration and runtime execution
 *
 * @returns A configured {@link Command} instance.
 *
 * @example
 * ```ts
 * const cli = buildCli();
 * cli.parseAsync(["node", "recon", "scan", "https://example.com"]);
 * ```
 */
export function buildCli(): Command {
  const program = new Command();

  program
    .name("recon")
    .description("UI automation recon toolkit (Playwright + TypeScript)")
    .version("0.1.0");

  registerScanCommand(program);

  return program;
}

/**
 * Executes the CLI when this module is run directly.
 *
 * @remarks
 * The `require.main === module` check ensures that the CLI is only executed
 * when invoked via the command line, and not when imported as a library
 * (e.g., during tests or programmatic usage).
 */
if (require.main === module) {
  buildCli().parseAsync(process.argv).catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  });
}

#!/usr/bin/env node
import { Command } from "commander";
import { registerScanCommand } from "./commands/scan";

export function buildCli(): Command {
  const program = new Command();

  program
    .name("recon")
    .description("UI automation recon toolkit (Playwright + TypeScript)")
    .version("0.1.0");

  registerScanCommand(program);

  return program;
}

if (require.main === module) {
  buildCli().parseAsync(process.argv).catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  });
}

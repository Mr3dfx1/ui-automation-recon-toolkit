import { Command } from "commander";
import { promises as fs } from "fs";
import path from "path";
import { buildPageModel } from "../../model/buildPageModel";
import { writePageModel } from "../../gen/writePageModel";
import type { ReconReport } from "../../reporting/types";

/**
 * Registers the `gen` command.
 *
 * @param program - Root CLI command.
 */
export function registerGenCommand(program: Command): void {
  program
    .command("gen")
    .description("Generate automation artifacts from a recon report")
    .requiredOption("-i, --input <file>", "Recon report JSON file")
    .option("-o, --output <dir>", "Output directory", "reports")
    .action(async (opts) => {
      
      // Input/Output dirs
      const inputPath = path.resolve(opts.input);
      const outputDir = path.resolve(opts.output);

      // Read file and parse it.
      const raw    = await fs.readFile(inputPath, "utf-8");
      const report = JSON.parse(raw) as ReconReport;

      // Build/Create output
      const model   = buildPageModel(report);
      const outPath = await writePageModel(outputDir, model);

      console.log(`[gen] page model written to ${outPath}`);
    });
}

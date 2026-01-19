import { Command } from "commander";
import { scanUrl } from "../../recon/scanPage";
import { writeJsonReport } from "../../reporting/writeJsonReport";

function parseUrl(raw: string): URL {
  let url: URL;

  try {
    url = new URL(raw);
  } catch {
    throw new Error(`Invalid URL: "${raw}"`);
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`URL must start with http:// or https:// (got "${url.protocol}")`);
  }

  return url;
}

export function registerScanCommand(program: Command): void {
  program
    .command("scan")
    .description("Scan a URL and output a recon report")
    .argument("<url>", "Target URL (http/https)")
    .option("-o, --output <dir>", "Output directory", "reports")
    .option("--headed", "Run browser in headed mode", false)
    .action(async (rawUrl: string, options: { output: string; headed: boolean }) => {
      const url = parseUrl(rawUrl).toString();

      console.log(`[recon] scanning: ${url}`);
      const report = await scanUrl(url, options.headed);

      const outPath = await writeJsonReport(options.output, report);
      console.log(`[recon] wrote report: ${outPath}`);
      console.log(`[recon] counts:`, report.counts);
    });
}

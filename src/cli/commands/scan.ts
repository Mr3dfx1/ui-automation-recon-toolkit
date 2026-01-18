import { Command } from "commander";

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
      const url = parseUrl(rawUrl);

      console.log(`[recon] scan starting`);
      console.log(`  url: ${url.toString()}`);
      console.log(`  output: ${options.output}`);
      console.log(`  headed: ${options.headed}`);
    });
}

import { promises as fs } from "fs";
import * as path from "path";
import { ReconReport } from "./types";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function safeSlug(input: string): string {
  // keep letters/numbers/hyphen; collapse junk into hyphens
  return input
    .toLowerCase()
    .replace(/^www\./, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildReportFileName(reportUrl: string, now = new Date()): string {
  const u = new URL(reportUrl);

  const mm = pad2(now.getMonth() + 1);
  const dd = pad2(now.getDate());
  const yyyy = String(now.getFullYear());

  const hh = pad2(now.getHours());
  const min = pad2(now.getMinutes());
  const ss = pad2(now.getSeconds());

  const domain = safeSlug(u.hostname); // e.g. www.google.com --> google-com
  const domainShort = domain.replace(/-com$|-net$|-org$/g, ""); // optional nicety

  return `recon-report-${mm}-${dd}-${yyyy}-${domainShort}-${hh}${min}${ss}.json`;
}

export async function writeJsonReport(outputDir: string, report: ReconReport): Promise<string> {
  await fs.mkdir(outputDir, { recursive: true });

  const fileName = buildReportFileName(report.url);
  const filePath = path.join(outputDir, fileName);

  await fs.writeFile(filePath, JSON.stringify(report, null, 2), "utf-8");
  return filePath;
}

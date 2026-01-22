/**
 * @fileoverview
 * JSON report writer utilities.
 *
 * @remarks
 * Produces non-destructive, timestamped report filenames to avoid overwriting
 * previous scans.
 */
import { promises as fs } from "fs";
import * as path from "path";
import { ReconReport } from "./types";

/**
 * Pads a number to a two-digit string.
 *
 * @param n - The number to pad.
 * @returns A two-digit string.
 *
 * @example
 * ```ts
 * pad2(3) // "03"
 * ```
 */
function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Converts an input string into a filesystem-safe slug.
 *
 * @remarks
 * Intended for hostnames/domains in report filenames.
 *
 * @param input - Raw string input.
 * @returns A lowercased slug containing only `a-z`, `0-9`, and hyphens.
 */
function safeSlug(input: string): string {
  // keep letters/numbers/hyphen; collapse junk into hyphens
  return input
    .toLowerCase()
    .replace(/^www\./, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Builds a timestamped report filename using the scan URL and current time.
 *
 * @remarks
 * Filename format:
 * `recon-report-MM-DD-YYYY-<domain>-HHMMSS.json`
 *
 * @param reportUrl - URL from the recon report.
 * @param now - Date used to generate the timestamp (primarily for testing).
 * @returns A report filename (not including directory path).
 */
function buildReportFileName(reportUrl: string, now = new Date()): string {
  const u    = new URL(reportUrl);
  const mm   = pad2(now.getMonth() + 1);
  const dd   = pad2(now.getDate());
  const yyyy = String(now.getFullYear());
  const hh   = pad2(now.getHours());
  const min  = pad2(now.getMinutes());
  const ss   = pad2(now.getSeconds());
  const domain      = safeSlug(u.hostname); // e.g. www.google.com --> google-com
  const domainShort = domain.replace(/-com$|-net$|-org$/g, ""); // optional nicety

  return `recon-report-${mm}-${dd}-${yyyy}-${domainShort}-${hh}${min}${ss}.json`;
}

/**
 * Writes a {@link ReconReport} to disk as formatted JSON.
 *
 * @remarks
 * Creates the output directory if it does not exist.
 *
 * @param outputDir - Directory where the report will be written.
 * @param report - The recon report object to serialize.
 * @returns Absolute or relative filepath to the written JSON file (depending on input).
 */
export async function writeJsonReport(outputDir: string, report: ReconReport): Promise<string> {
  await fs.mkdir(outputDir, { recursive: true });

  const fileName = buildReportFileName(report.url);
  const filePath = path.join(outputDir, fileName);

  await fs.writeFile(filePath, JSON.stringify(report, null, 2), "utf-8");
  return filePath;
}

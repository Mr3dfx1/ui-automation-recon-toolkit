/**
 * @fileoverview
 * Provides utilities for persisting a {@link PageModel} to disk.
 *
 * @remarks
 * This module is responsible for serializing the framework-agnostic Page Model
 * produced during the `gen` phase and writing it to a timestamped JSON file.
 *
 * The output is intended to serve as a stable, inspectable input for subsequent
 * automation generators (e.g. Playwright, Appium).
 */
import { promises as fs } from "fs";
import * as path from "path";
import type { PageModel } from "../model/pageModel";

/**
 * Writes a Page Model to disk using a stable, timestamped filename.
 *
 * @param outputDir - Directory to write to.
 * @param model - Page Model to serialize.
 * @returns Full path to the written file.
 */
export async function writePageModel(outputDir: string, model: PageModel): Promise<string> {
  // Make output dir
  await fs.mkdir(outputDir, { recursive: true });

  // Create output file dynamically named
  const ts       = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = `page-model-${model.domain}-${ts}.json`;
  const filePath = path.join(outputDir, fileName);

  // Write to file and return the filePath
  await fs.writeFile(filePath, JSON.stringify(model, null, 2), "utf-8");
  return filePath;
}

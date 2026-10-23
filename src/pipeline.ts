import fs from "node:fs";
import path from "node:path";
import { analyze, buildPrompt, type Analysis } from "./analyze.ts";
import { scanBackend } from "./backend/index.ts";
import { getFeature, resolveFrom, type LoadedConfig } from "./config.ts";
import { designKeywords, loadDesign } from "./design/index.ts";
import { renderReport } from "./report.ts";
import type { BackendSnippet, DesignSpec } from "./types.ts";

/** The three stages, shared by the CLI and the web UI. */

export async function runDesign(config: LoadedConfig, featureName: string): Promise<DesignSpec> {
  return loadDesign(config, featureName, getFeature(config, featureName));
}

export interface ScanResult {
  design: DesignSpec;
  keywords: string[];
  selected: BackendSnippet[];
  totalCandidates: number;
}

export async function runScan(config: LoadedConfig, featureName: string): Promise<ScanResult> {
  const feature = getFeature(config, featureName);
  const design = await loadDesign(config, featureName, feature);
  const keywords = designKeywords(design, feature.keywords);
  const { selected, totalCandidates } = await scanBackend(config, feature, keywords);
  return { design, keywords, selected, totalCandidates };
}

export function outputDir(config: LoadedConfig, featureName: string): string {
  return path.join(resolveFrom(config, config.outDir ?? "mediator-out"), featureName);
}

export interface AnalyzeResult {
  outDir: string;
  design: DesignSpec;
  prompt: string;
  analysis?: Analysis;
  report?: string;
}

export async function runAnalyze(
  config: LoadedConfig,
  featureName: string,
  opts: { dryRun?: boolean; onProgress?: (message: string) => void } = {},
): Promise<AnalyzeResult> {
  const progress = opts.onProgress ?? (() => {});
  const feature = getFeature(config, featureName);

  progress("Reading the design");
  const { design, selected } = await runScan(config, featureName);
  progress(`Found ${design.screens.length} screen(s) and ${selected.length} backend snippet(s)`);

  const outDir = outputDir(config, featureName);
  fs.mkdirSync(outDir, { recursive: true });
  const prompt = buildPrompt(design, selected, feature.description);
  fs.writeFileSync(path.join(outDir, "design.json"), JSON.stringify(design, null, 2));

  if (opts.dryRun) {
    fs.writeFileSync(path.join(outDir, "prompt.txt"), prompt);
    return { outDir, design, prompt };
  }

  const model = config.model ?? "claude-opus-5-5";
  progress(`Asking ${model} to compare them (this usually takes a few minutes)`);
  const analysis = await analyze(prompt, { model, effort: config.effort ?? "high" });
  const report = renderReport(design, analysis);

  fs.writeFileSync(path.join(outDir, "analysis.json"), JSON.stringify(analysis, null, 2));
  fs.writeFileSync(path.join(outDir, "contract.ts"), analysis.frontendContract.typescript);
  fs.writeFileSync(path.join(outDir, "mock.json"), analysis.frontendContract.mockJson);
  fs.writeFileSync(path.join(outDir, "report.md"), report);
  progress("Done");
  return { outDir, design, prompt, analysis, report };
}

/** The last saved analysis for a feature, if any. */
export function readLastRun(config: LoadedConfig, featureName: string) {
  const dir = outputDir(config, featureName);
  const read = (file: string) => {
    const p = path.join(dir, file);
    return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null;
  };
  const analysisJson = read("analysis.json");
  if (!analysisJson) return null;
  return {
    outDir: dir,
    finishedAt: fs.statSync(path.join(dir, "analysis.json")).mtime.toISOString(),
    analysis: JSON.parse(analysisJson) as Analysis,
    design: JSON.parse(read("design.json") ?? "null") as DesignSpec | null,
    report: read("report.md"),
  };
}

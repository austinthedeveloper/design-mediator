#!/usr/bin/env -S npx tsx
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { analyze, buildPrompt } from "./analyze.ts";
import { scanBackend } from "./backend/index.ts";
import { getFeature, loadConfig, resolveFrom } from "./config.ts";
import { designKeywords, loadDesign } from "./design/index.ts";
import { renderReport } from "./report.ts";

const USAGE = `design-mediator: compare Figma designs with what the backend actually has.

Usage:
  mediator design  <feature>             Print the fields extracted from the design
  mediator scan    <feature>             Print the backend code that looks relevant
  mediator analyze <feature> [--dry-run] Run the AI gap analysis and write a report

Options:
  -c, --config <path>   Config file (default: mediator.config.json)
      --dry-run         Write the prompt to the output folder without calling Claude
  -h, --help
`;

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      config: { type: "string", short: "c", default: "mediator.config.json" },
      "dry-run": { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
  });
  const [command, featureName] = positionals;
  if (values.help || !command || !featureName) {
    process.stdout.write(USAGE);
    process.exit(values.help ? 0 : 1);
  }

  const config = loadConfig(values.config!);
  const feature = getFeature(config, featureName);
  const design = await loadDesign(config, featureName, feature);

  if (command === "design") {
    console.log(JSON.stringify(design, null, 2));
    return;
  }

  const keywords = designKeywords(design, feature.keywords);
  const { selected, totalCandidates } = await scanBackend(config, feature, keywords);

  if (command === "scan") {
    console.log(`Keywords: ${keywords.join(", ")}`);
    console.log(`${selected.length} of ${totalCandidates} candidate snippets selected:\n`);
    for (const s of selected) {
      console.log(`  [${String(s.score).padStart(3)}] ${s.repo}/${s.file}:${s.startLine}-${s.endLine} (${s.kind})`);
    }
    return;
  }

  if (command !== "analyze") throw new Error(`Unknown command "${command}"\n\n${USAGE}`);

  const outDir = path.join(resolveFrom(config, config.outDir ?? "mediator-out"), featureName);
  fs.mkdirSync(outDir, { recursive: true });
  const prompt = buildPrompt(design, selected, feature.description);
  fs.writeFileSync(path.join(outDir, "design.json"), JSON.stringify(design, null, 2));

  if (values["dry-run"]) {
    fs.writeFileSync(path.join(outDir, "prompt.txt"), prompt);
    console.log(`Dry run: prompt (${prompt.length.toLocaleString()} chars) written to ${path.join(outDir, "prompt.txt")}`);
    return;
  }

  const model = config.model ?? "claude-opus-5-5";
  console.error(`Analyzing ${design.screens.length} screen(s) against ${selected.length} backend snippet(s) with ${model}...`);
  const analysis = await analyze(prompt, { model, effort: config.effort ?? "high" });

  fs.writeFileSync(path.join(outDir, "analysis.json"), JSON.stringify(analysis, null, 2));
  fs.writeFileSync(path.join(outDir, "contract.ts"), analysis.frontendContract.typescript);
  fs.writeFileSync(path.join(outDir, "mock.json"), analysis.frontendContract.mockJson);
  fs.writeFileSync(path.join(outDir, "report.md"), renderReport(design, analysis));
  console.log(`Report written to ${path.join(outDir, "report.md")}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

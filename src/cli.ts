#!/usr/bin/env -S npx tsx
import path from "node:path";
import { parseArgs } from "node:util";
import { loadConfig } from "./config.ts";
import { runAnalyze, runDesign, runScan } from "./pipeline.ts";

const USAGE = `design-mediator: compare Figma designs with what the backend actually has.

Usage:
  mediator design  <feature>             Print the fields extracted from the design
  mediator scan    <feature>             Print the backend code that looks relevant
  mediator analyze <feature> [--dry-run] Run the AI gap analysis and write a report
  npm run ui                             Open the web UI to set up repos, keys and features

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

  if (command === "design") {
    console.log(JSON.stringify(await runDesign(config, featureName), null, 2));
    return;
  }

  if (command === "scan") {
    const { keywords, selected, totalCandidates } = await runScan(config, featureName);
    console.log(`Keywords: ${keywords.join(", ")}`);
    console.log(`${selected.length} of ${totalCandidates} candidate snippets selected:\n`);
    for (const s of selected) {
      console.log(`  [${String(s.score).padStart(3)}] ${s.repo}/${s.file}:${s.startLine}-${s.endLine} (${s.kind})`);
    }
    return;
  }

  if (command !== "analyze") throw new Error(`Unknown command "${command}"\n\n${USAGE}`);

  const dryRun = values["dry-run"];
  const result = await runAnalyze(config, featureName, {
    dryRun,
    onProgress: (m) => console.error(`${m}...`),
  });
  if (dryRun) {
    console.log(`Dry run: prompt (${result.prompt.length.toLocaleString()} chars) written to ${path.join(result.outDir, "prompt.txt")}`);
  } else {
    console.log(`Report written to ${path.join(result.outDir, "report.md")}`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

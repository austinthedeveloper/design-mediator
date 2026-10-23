import fs from "node:fs";
import type { LoadedConfig } from "../config.ts";
import { resolveFrom } from "../config.ts";
import type { BackendSnippet, FeatureConfig } from "../types.ts";
import { scanRepo, selectSnippets } from "./scan.ts";

export async function scanBackend(
  config: LoadedConfig,
  feature: FeatureConfig,
  keywords: string[],
): Promise<{ selected: BackendSnippet[]; totalCandidates: number }> {
  const wanted = feature.repos;
  const repos = config.repos.filter((r) => !wanted || wanted.includes(r.name));
  if (repos.length === 0) throw new Error("No repos matched this feature's `repos` list");

  const all: BackendSnippet[] = [];
  for (const repo of repos) {
    const root = resolveFrom(config, repo.path);
    if (!fs.existsSync(root)) throw new Error(`Repo "${repo.name}" not found at ${root}`);
    all.push(...(await scanRepo(repo, root, keywords)));
  }
  return {
    selected: selectSnippets(all, config.backendBudgetChars ?? 200_000),
    totalCandidates: all.length,
  };
}

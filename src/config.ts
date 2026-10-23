import fs from "node:fs";
import path from "node:path";
import type { FeatureConfig, MediatorConfig } from "./types.ts";

export interface LoadedConfig extends MediatorConfig {
  /** Directory the config file lives in; relative paths resolve against it. */
  baseDir: string;
}

export function loadConfig(configPath: string): LoadedConfig {
  const abs = path.resolve(configPath);
  if (!fs.existsSync(abs)) {
    throw new Error(`Config not found: ${abs} (copy mediator.config.example.json, or run \`npm run ui\` to set one up)`);
  }
  const raw = JSON.parse(fs.readFileSync(abs, "utf8")) as MediatorConfig;
  validateConfig(raw, abs);
  return { ...raw, baseDir: path.dirname(abs) };
}

/** Like loadConfig, but a missing file is an empty config (the UI creates it on first save). */
export function loadConfigOrEmpty(configPath: string): LoadedConfig {
  const abs = path.resolve(configPath);
  if (!fs.existsSync(abs)) return { repos: [], features: {}, baseDir: path.dirname(abs) };
  return loadConfig(abs);
}

export function saveConfig(configPath: string, config: MediatorConfig): void {
  const abs = path.resolve(configPath);
  validateConfig(config, abs);
  const { baseDir: _ignored, ...plain } = config as LoadedConfig;
  fs.writeFileSync(abs, JSON.stringify(plain, null, 2) + "\n");
}

function validateConfig(raw: MediatorConfig, where: string): void {
  if (!Array.isArray(raw.repos) || typeof raw.features !== "object" || raw.features === null) {
    throw new Error(`${where}: expected "repos" (array) and "features" (object)`);
  }
  const names = new Set<string>();
  for (const repo of raw.repos) {
    if (!repo.name || !repo.path) throw new Error(`${where}: every repo needs a "name" and a "path"`);
    if (names.has(repo.name)) throw new Error(`${where}: repo name "${repo.name}" is used twice`);
    names.add(repo.name);
  }
}

export function getFeature(config: LoadedConfig, name: string): FeatureConfig {
  const feature = config.features[name];
  if (!feature) {
    const known = Object.keys(config.features).join(", ") || "(none)";
    throw new Error(`Unknown feature "${name}". Known features: ${known}`);
  }
  return feature;
}

export function resolveFrom(config: LoadedConfig, p: string): string {
  return path.resolve(config.baseDir, p);
}

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
    throw new Error(`Config not found: ${abs} (copy mediator.config.example.json to get started)`);
  }
  const raw = JSON.parse(fs.readFileSync(abs, "utf8")) as MediatorConfig;
  if (!Array.isArray(raw.repos) || !raw.features) {
    throw new Error(`${abs}: expected "repos" (array) and "features" (object)`);
  }
  return { ...raw, baseDir: path.dirname(abs) };
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

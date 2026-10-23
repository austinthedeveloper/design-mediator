import type { LoadedConfig } from "../config.ts";
import { resolveFrom } from "../config.ts";
import type { DesignSpec, FeatureConfig } from "../types.ts";
import { extractDesignSpec, fetchFigmaNodes, loadDesignFile } from "./figma.ts";

export async function loadDesign(config: LoadedConfig, name: string, feature: FeatureConfig): Promise<DesignSpec> {
  if (feature.designFile) return loadDesignFile(resolveFrom(config, feature.designFile), name);
  if (feature.figma) {
    const nodes = await fetchFigmaNodes(feature.figma);
    return extractDesignSpec(nodes, name, `figma:${feature.figma.fileKey}`);
  }
  throw new Error(`Feature "${name}" needs either "figma" or "designFile"`);
}

/** Words worth searching the backend for, pulled from the design itself. */
export function designKeywords(spec: DesignSpec, extra: string[] = []): string[] {
  const words = new Set<string>();
  const add = (s: string) => {
    for (const w of s.toLowerCase().split(/[^a-z0-9]+/)) {
      if (w.length >= 3 && !STOPWORDS.has(w)) words.add(singular(w));
    }
  };
  add(spec.feature);
  for (const screen of spec.screens) {
    add(screen.name);
    screen.fields.forEach((f) => add(f.label));
  }
  extra.forEach(add);
  return [...words];
}

function singular(w: string) {
  if (w.endsWith("ies")) return w.slice(0, -3) + "y";
  if (w.endsWith("ses")) return w.slice(0, -2);
  if (w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
}

const STOPWORDS = new Set([
  "the", "and", "for", "add", "new", "edit", "create", "update", "your", "with", "this", "that",
  "screen", "page", "step", "details", "optional", "required", "enter", "select", "save", "cancel",
]);

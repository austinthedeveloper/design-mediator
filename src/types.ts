export type FieldKind =
  | "text"
  | "richtext"
  | "number"
  | "currency"
  | "select"
  | "multiselect"
  | "toggle"
  | "checkbox"
  | "date"
  | "image"
  | "file"
  | "unknown";

/** A single input-ish thing a designer put on a screen. */
export interface DesignField {
  label: string;
  kind: FieldKind;
  required: boolean;
  placeholder?: string;
  helperText?: string;
  options?: string[];
  /** Figma component name, e.g. "Input / Currency". Useful context for the model. */
  component?: string;
  nodeId?: string;
}

export interface DesignScreen {
  name: string;
  nodeId?: string;
  fields: DesignField[];
  /** Button labels, e.g. "Save product". */
  actions: string[];
  /** Remaining copy on the screen (headings, table headers, empty states...). */
  texts: string[];
}

export interface DesignSpec {
  feature: string;
  source: string;
  screens: DesignScreen[];
}

export interface BackendSnippet {
  repo: string;
  /** Path relative to the repo root. */
  file: string;
  startLine: number;
  endLine: number;
  kind: string;
  score: number;
  text: string;
}

export interface FigmaSource {
  fileKey: string;
  nodeIds: string[];
}

export interface FeatureConfig {
  description?: string;
  figma?: FigmaSource;
  /** Local design export (Figma nodes JSON or an already-normalized DesignSpec). */
  designFile?: string;
  /** Repo names from `repos`; defaults to all. */
  repos?: string[];
  /** Extra search terms for the backend scan (domain words, legacy table names...). */
  keywords?: string[];
}

export interface RepoConfig {
  name: string;
  path: string;
  include?: string[];
  exclude?: string[];
}

export interface MediatorConfig {
  model?: string;
  effort?: "low" | "medium" | "high" | "xhigh" | "max";
  /** Max characters of backend code sent to the model. */
  backendBudgetChars?: number;
  outDir?: string;
  repos: RepoConfig[];
  features: Record<string, FeatureConfig>;
}

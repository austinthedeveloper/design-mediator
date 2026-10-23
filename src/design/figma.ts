import fs from "node:fs";
import { getCredential } from "../credentials.ts";
import type { DesignField, DesignScreen, DesignSpec, FieldKind, FigmaSource } from "../types.ts";

/** The subset of the Figma REST node shape we read. */
export interface FigmaNode {
  id: string;
  name: string;
  type: string;
  characters?: string;
  visible?: boolean;
  children?: FigmaNode[];
  componentProperties?: Record<string, { type: string; value: string | boolean }>;
}

interface FigmaNodesResponse {
  nodes: Record<string, { document: FigmaNode } | null>;
}

export async function fetchFigmaNodes(source: FigmaSource): Promise<FigmaNode[]> {
  const token = getCredential("figmaToken");
  if (!token) throw new Error("No Figma token: set FIGMA_TOKEN or save one in the UI (Figma > Settings > Personal access tokens)");

  const url = new URL(`https://api.figma.com/v1/files/${source.fileKey}/nodes`);
  url.searchParams.set("ids", source.nodeIds.join(","));
  const res = await fetch(url, { headers: { "X-Figma-Token": token } });
  if (!res.ok) throw new Error(`Figma API ${res.status}: ${await res.text()}`);

  const body = (await res.json()) as FigmaNodesResponse;
  return documentsFrom(body);
}

/**
 * Load a local design export. Accepts a Figma `/nodes` response, a single
 * Figma node, or a DesignSpec that something else (e.g. Claude + Figma MCP)
 * already normalized.
 */
export function loadDesignFile(file: string, feature: string): DesignSpec {
  const json = JSON.parse(fs.readFileSync(file, "utf8"));
  if (Array.isArray(json.screens)) return { feature, source: file, ...json };
  const roots = json.nodes ? documentsFrom(json as FigmaNodesResponse) : [json as FigmaNode];
  return extractDesignSpec(roots, feature, file);
}

function documentsFrom(body: FigmaNodesResponse): FigmaNode[] {
  return Object.values(body.nodes).flatMap((n) => (n ? [n.document] : []));
}

const FIELD_PATTERN =
  /\b(input|text ?field|textfield|text ?area|textarea|select|dropdown|combo ?box|autocomplete|checkbox|toggle|switch|radio|date ?picker|upload|dropzone|file ?picker|stepper|currency|price|tag ?input|chips?)\b/i;
const BUTTON_PATTERN = /\b(button|btn|cta)\b/i;
const CONTAINER_TYPES = new Set(["FRAME", "SECTION", "CANVAS", "GROUP", "COMPONENT_SET"]);

/**
 * Turn Figma frames into screens. Each top-level frame under a requested node
 * is a screen; if the requested node is itself a screen, it is used directly.
 */
export function extractDesignSpec(roots: FigmaNode[], feature: string, source: string): DesignSpec {
  const screens: DesignScreen[] = [];
  for (const root of roots) {
    const frames = (root.type === "CANVAS" || root.type === "SECTION")
      ? (root.children ?? []).filter((c) => c.type === "FRAME")
      : [root];
    for (const frame of frames) screens.push(extractScreen(frame));
  }
  return { feature, source, screens };
}

function extractScreen(frame: FigmaNode): DesignScreen {
  const fields: DesignField[] = [];
  const actions: string[] = [];
  const texts: string[] = [];
  const claimed = new Set<string>();

  const walk = (node: FigmaNode) => {
    if (node.visible === false) return;
    if (node.type !== "TEXT" && !CONTAINER_TYPES.has(node.type) && FIELD_PATTERN.test(node.name)) {
      const field = toField(node);
      if (field) {
        fields.push(field);
        textNodes(node).forEach((t) => claimed.add(t.id));
        return;
      }
    }
    if (BUTTON_PATTERN.test(node.name) && node.type !== "TEXT") {
      const label = textNodes(node).map((t) => t.characters?.trim()).find(Boolean);
      if (label) actions.push(label);
      textNodes(node).forEach((t) => claimed.add(t.id));
      return;
    }
    if (node.type === "TEXT" && node.characters?.trim() && !claimed.has(node.id)) {
      texts.push(node.characters.trim());
    }
    node.children?.forEach(walk);
  };
  frame.children?.forEach(walk);

  return { name: frame.name, nodeId: frame.id, fields, actions, texts: [...new Set(texts)] };
}

function toField(node: FigmaNode): DesignField | null {
  const props = componentText(node);
  const texts = textNodes(node);
  const byName = (re: RegExp) => texts.find((t) => re.test(t.name))?.characters?.trim();

  const label =
    props.label ?? byName(/label|title/i) ?? texts[0]?.characters?.trim() ?? node.name;
  if (!label) return null;

  const placeholder = props.placeholder ?? byName(/placeholder|value|hint/i);
  const helperText = props.helper ?? byName(/helper|description|caption|error/i);
  const options = texts
    .filter((t) => /option|item|chip|tag/i.test(t.name))
    .map((t) => t.characters!.trim())
    .filter(Boolean);

  const required = /\*\s*$/.test(label) || props.required === true;
  return {
    label: label.replace(/\s*\*\s*$/, ""),
    kind: inferKind(node.name, label, placeholder),
    required,
    ...(placeholder && placeholder !== label ? { placeholder } : {}),
    ...(helperText && helperText !== label ? { helperText } : {}),
    ...(options.length ? { options } : {}),
    component: node.name,
    nodeId: node.id,
  };
}

/** Pull label/placeholder/helper/required from Figma component properties ("Label#12:0"). */
function componentText(node: FigmaNode) {
  const out: { label?: string; placeholder?: string; helper?: string; required?: boolean } = {};
  for (const [key, prop] of Object.entries(node.componentProperties ?? {})) {
    const k = key.split("#")[0].toLowerCase();
    if (prop.type === "TEXT" && typeof prop.value === "string") {
      if (k.includes("label")) out.label = prop.value;
      else if (k.includes("placeholder")) out.placeholder = prop.value;
      else if (k.includes("helper") || k.includes("hint")) out.helper = prop.value;
    } else if (prop.type === "BOOLEAN" && k.includes("required")) {
      out.required = prop.value === true;
    }
  }
  return out;
}

function inferKind(component: string, label: string, placeholder?: string): FieldKind {
  const s = `${component} ${label} ${placeholder ?? ""}`.toLowerCase();
  if (/upload|dropzone|image|photo|media/.test(s)) return /file|document/.test(s) ? "file" : "image";
  if (/multi|tag|chip/.test(s)) return "multiselect";
  if (/select|dropdown|combo|autocomplete|radio/.test(s)) return "select";
  if (/toggle|switch/.test(s)) return "toggle";
  if (/checkbox/.test(s)) return "checkbox";
  if (/date|calendar/.test(s)) return "date";
  if (/currency|price|cost|amount|\$/.test(s)) return "currency";
  if (/stepper|number|qty|quantity|count|weight/.test(s)) return "number";
  if (/rich|editor|text ?area|description/.test(s)) return "richtext";
  if (/input|field/.test(s)) return "text";
  return "unknown";
}

function textNodes(node: FigmaNode): FigmaNode[] {
  if (node.visible === false) return [];
  if (node.type === "TEXT") return [node];
  return (node.children ?? []).flatMap(textNodes);
}

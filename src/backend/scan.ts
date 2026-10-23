import fs from "node:fs";
import path from "node:path";
import fg from "fast-glob";
import type { BackendSnippet, RepoConfig } from "../types.ts";

/**
 * Files that usually describe a backend's data shape or API surface.
 * Override per repo with `include` in the config.
 */
export const DEFAULT_INCLUDE = [
  "**/*.prisma",
  "**/*.sql",
  "**/*.{graphql,gql}",
  "**/{openapi,swagger}*.{json,yaml,yml}",
  "**/*{entity,entities,model,models,dto,schema,schemas,types,serializer,serializers,controller,routes,router,resolver,handler}*.{ts,js,py,java,kt,cs,go,rb,php}",
  "**/{models,entities,dto,dtos,schemas,controllers,routes,migrations,domain}/**/*.{ts,js,py,java,kt,cs,go,rb,php,sql}",
];

export const DEFAULT_EXCLUDE = [
  "**/node_modules/**", "**/dist/**", "**/build/**", "**/.git/**", "**/.next/**",
  "**/coverage/**", "**/vendor/**", "**/*.spec.*", "**/*.test.*", "**/__tests__/**",
  "**/*.d.ts", "**/*.min.js",
];

const MAX_FILE_BYTES = 400_000;

export async function scanRepo(repo: RepoConfig, repoRoot: string, keywords: string[]): Promise<BackendSnippet[]> {
  const files = await fg(repo.include ?? DEFAULT_INCLUDE, {
    cwd: repoRoot,
    ignore: [...DEFAULT_EXCLUDE, ...(repo.exclude ?? [])],
    onlyFiles: true,
    unique: true,
  });

  const snippets: BackendSnippet[] = [];
  for (const file of files) {
    const abs = path.join(repoRoot, file);
    if (fs.statSync(abs).size > MAX_FILE_BYTES) continue;
    const text = fs.readFileSync(abs, "utf8");
    const pathScore = scoreText(file, keywords) * 3;
    for (const block of splitBlocks(file, text)) {
      const score = scoreText(block.text, keywords) + (block.kind === "window" ? 0 : pathScore);
      if (score > 0) snippets.push({ repo: repo.name, file, ...block, score });
    }
  }
  return snippets;
}

/** Highest-scoring snippets that fit in the character budget, in file order. */
export function selectSnippets(snippets: BackendSnippet[], budgetChars: number): BackendSnippet[] {
  const picked: BackendSnippet[] = [];
  let used = 0;
  for (const s of [...snippets].sort((a, b) => b.score - a.score)) {
    if (used + s.text.length > budgetChars) continue;
    picked.push(s);
    used += s.text.length;
  }
  return picked.sort((a, b) =>
    a.repo.localeCompare(b.repo) || a.file.localeCompare(b.file) || a.startLine - b.startLine);
}

/** Count keyword hits, splitting camelCase/snake_case so `compareAtPrice` matches "price". */
function scoreText(text: string, keywords: string[]): number {
  const words = text
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/);
  const set = new Set(keywords);
  let score = 0;
  for (const w of words) {
    if (set.has(w) || (w.endsWith("s") && set.has(w.slice(0, -1)))) score++;
  }
  return score;
}

interface Block { startLine: number; endLine: number; kind: string; text: string }

const DECLARATION =
  /^\s*(?:export\s+)?(?:default\s+)?(?:public\s+|abstract\s+|data\s+|final\s+)*(model|enum|type|input|interface|class|record|struct|schema|table|create\s+table|alter\s+table|create\s+type)\b/i;
const ROUTE = /^\s*(@(Get|Post|Put|Patch|Delete|Controller|Route|RequestMapping|\w+Mapping)\b|(router|app|r)\.(get|post|put|patch|delete)\(|@(app|router)\.(get|post|put|patch|delete)\()/i;

/** Split a file into declaration-sized blocks; fall back to fixed windows. */
function splitBlocks(file: string, text: string): Block[] {
  const lines = text.split("\n");
  const ext = path.extname(file).toLowerCase();
  const blocks: Block[] = [];

  for (let i = 0; i < lines.length; i++) {
    const m = DECLARATION.exec(lines[i]) ?? ROUTE.exec(lines[i]);
    if (!m) continue;
    // Pull leading decorators/comments into the block.
    let start = i;
    while (start > 0 && /^\s*(@|\/\/|#|\*|\/\*|--)/.test(lines[start - 1])) start--;
    const end =
      ext === ".sql" ? untilSemicolon(lines, i)
      : ext === ".py" ? untilDedent(lines, i)
      : untilBalanced(lines, i);
    blocks.push({
      startLine: start + 1,
      endLine: end + 1,
      kind: m[1]?.toLowerCase().replace(/\s+/g, " ") ?? "route",
      text: lines.slice(start, end + 1).join("\n"),
    });
    i = end;
  }

  if (blocks.length === 0) {
    const size = 60;
    for (let i = 0; i < lines.length; i += size) {
      const end = Math.min(lines.length, i + size) - 1;
      blocks.push({ startLine: i + 1, endLine: end + 1, kind: "window", text: lines.slice(i, end + 1).join("\n") });
    }
  }
  return blocks;
}

function untilBalanced(lines: string[], from: number): number {
  let depth = 0;
  let opened = false;
  for (let i = from; i < lines.length; i++) {
    for (const ch of lines[i]) {
      if (ch === "{") { depth++; opened = true; }
      else if (ch === "}") depth--;
    }
    if (opened && depth <= 0) return i;
    // A one-line declaration (type alias, single route) with no body.
    if (!opened && i > from + 2) return from;
  }
  return Math.min(lines.length - 1, from + 200);
}

function untilSemicolon(lines: string[], from: number): number {
  for (let i = from; i < lines.length; i++) if (lines[i].includes(";")) return i;
  return lines.length - 1;
}

function untilDedent(lines: string[], from: number): number {
  const indent = lines[from].search(/\S/);
  let last = from;
  for (let i = from + 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    if (lines[i].search(/\S/) <= indent) break;
    last = i;
  }
  return last;
}

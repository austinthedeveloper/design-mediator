import type { Analysis } from "./analyze.ts";
import type { DesignSpec } from "./types.ts";

const STATUS_ICON: Record<Analysis["fields"][number]["status"], string> = {
  matched: "✅ matched",
  missing_in_backend: "❌ missing in backend",
  missing_in_design: "🎨 missing in design",
  type_mismatch: "⚠️ type mismatch",
  validation_mismatch: "⚠️ validation mismatch",
  naming_mismatch: "↔️ naming mismatch",
  unclear: "❓ unclear",
};

const ENDPOINT_ICON = { exists: "✅", needs_change: "⚠️", missing: "❌" } as const;

export function renderReport(design: DesignSpec, a: Analysis, generatedAt = new Date()): string {
  const counts = new Map<string, number>();
  for (const f of a.fields) counts.set(f.status, (counts.get(f.status) ?? 0) + 1);

  const cell = (s: string | null | undefined) => (s ?? "—").replace(/\|/g, "\\|").replace(/\n/g, " ");
  const questions = (qs: Analysis["questionsForDesign"]) =>
    qs.length === 0
      ? "_None._"
      : [...qs]
          .sort((x, y) => PRIORITY[x.priority] - PRIORITY[y.priority])
          .map((q) => `- [ ] **${q.priority}** ${q.question}\n  <br><sub>${q.why}</sub>`)
          .join("\n");

  return `# ${design.feature}: design ↔ backend gap report

<sub>Generated ${generatedAt.toISOString()} from ${design.source} (${design.screens.length} screen(s))</sub>

## Summary

${a.summary}

| Status | Fields |
|---|---|
${[...counts].map(([k, v]) => `| ${STATUS_ICON[k as keyof typeof STATUS_ICON]} | ${v} |`).join("\n")}

## Field matrix

| Screen | Design field | Design type | Backend field | Backend type | Status | Notes |
|---|---|---|---|---|---|---|
${a.fields
  .map((f) =>
    `| ${cell(f.screen)} | ${cell(f.designLabel)} | ${cell(f.designType)} | ${cell(f.backendField)}${f.source ? `<br><sub>${cell(f.source)}</sub>` : ""} | ${cell(f.backendType)} | ${STATUS_ICON[f.status]} | ${cell(f.notes)} |`)
  .join("\n")}

## Endpoints

| | Method | Path | Purpose | Notes |
|---|---|---|---|---|
${a.endpoints
  .map((e) => `| ${ENDPOINT_ICON[e.status]} | ${e.method} | \`${e.path}\` | ${cell(e.purpose)} | ${cell(e.notes)}${e.source ? ` <sub>${cell(e.source)}</sub>` : ""} |`)
  .join("\n")}

## Questions for design

${questions(a.questionsForDesign)}

## Questions for backend

${questions(a.questionsForBackend)}

## Risks

${a.risks.map((r) => `- ${r}`).join("\n") || "_None._"}

## Backend entities involved

${a.entities.map((e) => `- **${e.name}** — ${e.notes}${e.sources.length ? ` <sub>${e.sources.join(", ")}</sub>` : ""}`).join("\n")}

## Frontend contract (draft)

Also written to \`contract.ts\` and \`mock.json\` next to this report.

\`\`\`ts
${a.frontendContract.typescript.trim()}
\`\`\`
`;
}

const PRIORITY = { blocker: 0, high: 1, low: 2 } as const;

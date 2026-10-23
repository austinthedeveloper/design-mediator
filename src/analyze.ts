import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import type { BackendSnippet, DesignSpec, MediatorConfig } from "./types.ts";

const Source = z.string().describe('Where this came from, as "repo/path:line". Empty string if none.');

export const AnalysisSchema = z.object({
  summary: z.string().describe("3-5 sentences: how ready the backend is for this design and the biggest blockers."),
  entities: z.array(z.object({
    name: z.string(),
    sources: z.array(Source),
    notes: z.string(),
  })).describe("Backend entities/tables/DTOs this feature touches."),
  fields: z.array(z.object({
    screen: z.string().nullable(),
    designLabel: z.string().nullable(),
    designType: z.string().nullable(),
    backendField: z.string().nullable().describe("e.g. Product.priceCents"),
    backendType: z.string().nullable(),
    source: Source,
    status: z.enum([
      "matched",
      "missing_in_backend",
      "missing_in_design",
      "type_mismatch",
      "validation_mismatch",
      "naming_mismatch",
      "unclear",
    ]),
    notes: z.string(),
  })),
  endpoints: z.array(z.object({
    method: z.string(),
    path: z.string(),
    purpose: z.string(),
    status: z.enum(["exists", "needs_change", "missing"]),
    source: Source,
    notes: z.string(),
  })),
  questionsForDesign: z.array(z.object({
    question: z.string(),
    why: z.string(),
    priority: z.enum(["blocker", "high", "low"]),
  })),
  questionsForBackend: z.array(z.object({
    question: z.string(),
    why: z.string(),
    priority: z.enum(["blocker", "high", "low"]),
  })),
  risks: z.array(z.string()),
  frontendContract: z.object({
    typescript: z.string().describe(
      "TypeScript the frontend can build against today: request/response types for each endpoint, " +
      "with `// TODO(backend)` / `// TODO(design)` comments on anything not yet agreed.",
    ),
    mockJson: z.string().describe("A realistic JSON example of the main response, for mocks/MSW."),
  }),
});

export type Analysis = z.infer<typeof AnalysisSchema>;

const SYSTEM = `You mediate between a design team, a backend team, and a frontend team building a new application.
Design produces Figma mocks quickly. Backend is migrating a legacy system and doesn't track every design change.
Frontend is stuck in the middle. Your job is to give frontend an honest, specific picture of the gap so they can
keep building and ask the right people the right questions.

How to work:
- Map every design field to a backend field when one exists. Match on meaning, not just name (e.g. "Price" vs priceCents, "Active" toggle vs status enum).
- Only claim a backend field or endpoint exists if it is in the provided code. Cite it as "repo/path:line". If you didn't see it, it is missing or unclear, never assumed.
- Flag backend fields the design doesn't account for when the backend requires them (non-nullable without default, validated as required, used in a unique constraint). Ignore system-managed fields (ids, timestamps, audit columns).
- Call out type, unit, format and validation differences (money in cents vs decimal, enum vs boolean, length limits, single vs multiple values).
- When the legacy schema and the new schema disagree, say which one the new API actually exposes.
- Questions must be answerable and addressed to whoever can answer them. One decision per question.
- The frontend contract should reflect what the API will most plausibly look like after the gaps are closed, with TODO comments where it depends on an open question.`;

export function buildPrompt(design: DesignSpec, snippets: BackendSnippet[], description?: string): string {
  const code = snippets
    .map((s) => `<snippet source="${s.repo}/${s.file}:${s.startLine}-${s.endLine}" kind="${s.kind}">\n${s.text}\n</snippet>`)
    .join("\n\n");
  return [
    `<feature name="${design.feature}">${description ?? ""}</feature>`,
    `<design source="${design.source}">\n${JSON.stringify(design.screens, null, 2)}\n</design>`,
    `<backend_code>\n${code || "(no relevant backend code found)"}\n</backend_code>`,
    "Analyze the gap between this design and the backend.",
  ].join("\n\n");
}

export async function analyze(
  prompt: string,
  opts: { model: string; effort: NonNullable<MediatorConfig["effort"]> },
  client: Anthropic = new Anthropic(),
): Promise<Analysis> {
  // Streamed so large outputs don't hit request timeouts; finalMessage() still gives parsed_output.
  const stream = client.beta.messages.stream({
    model: opts.model,
    max_tokens: 64000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: SYSTEM,
    output_config: { effort: opts.effort, format: betaZodOutputFormat(AnalysisSchema) },
    messages: [{ role: "user", content: prompt }],
  });
  const response = await stream.finalMessage();

  if (response.stop_reason === "refusal") {
    throw new Error(`Model declined the request: ${response.stop_details?.explanation ?? "no explanation"}`);
  }
  if (response.stop_reason === "max_tokens") {
    throw new Error("Analysis was cut off at max_tokens; narrow the feature or lower backendBudgetChars");
  }
  if (!response.parsed_output) throw new Error("Model response did not match the analysis schema");
  return response.parsed_output;
}

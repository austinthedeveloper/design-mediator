# design-mediator

Compares what design put in Figma with what the backend actually has, and gives frontend:

- a **field matrix**: every design field mapped to a backend field, or flagged as missing / mismatched, with `file:line` citations
- **endpoint status**: exists / needs change / missing
- **questions for design** and **questions for backend**, ranked by priority (blocker / high / low)
- a **draft frontend contract** (`contract.ts` + `mock.json`) to build against while the gaps get closed

## How it works

```
Figma frames ──► design extractor ──► DesignSpec (screens, fields, actions, copy)
                                         │ keywords
monorepo(s) ──► backend scanner ─────────┴──► relevant snippets (Prisma, SQL, DTOs, controllers, OpenAPI…)
                                                  │
                                    Claude (structured output) ──► analysis.json ──► report.md / contract.ts / mock.json
```

1. **Design**: pulls nodes from the Figma REST API (or a local export) and finds inputs, selects, toggles, uploads and buttons using component names, component properties and nearby text. Required fields come from a trailing `*` or a `required` boolean prop.
2. **Backend**: globs schema-like files in each repo, splits them into declarations (models, tables, classes, routes) and ranks them by how often they mention words from the design. Only the top snippets, up to `backendBudgetChars`, go to the model.
3. **Analysis**: one Claude call with a strict JSON schema. The prompt tells the model not to assume a field exists unless it has seen it in the code.

## Usage

```bash
npm install
cp mediator.config.example.json mediator.config.json
export ANTHROPIC_API_KEY=...   # or `ant auth login`
export FIGMA_TOKEN=...         # only for features with a "figma" source
```

```bash
npm run mediator -- design add-product            # what did we extract from the design?
npm run mediator -- scan add-product              # what backend code looks relevant?
npm run mediator -- analyze add-product --dry-run # write the prompt without calling Claude
npm run mediator -- analyze add-product           # full report → mediator-out/add-product/
```

The example config points at `examples/`: a two-screen "Add Product" design and a small fake monorepo, with a migrated Prisma model, a NestJS DTO and controller, and the legacy SQL table. The gaps are planted on purpose: description, compare-at price, tags, images and inventory exist in the legacy table or the design but not in the new API; `weightGrams` is required by the API but has no field in the design; price is in cents vs. dollars; "Active" is a toggle where the backend has a status enum.

### Pointing it at your own monorepo

1. Clone this repo anywhere (it doesn't need to live inside the monorepo) and run `npm install`. Requires Node 20+.
2. In `mediator.config.json`, set `repos[].path` to the monorepo. Use an absolute path or one relative to the config file.
3. Add a feature with a `figma` source (needs `FIGMA_TOKEN`) or a `designFile`.
4. Run `scan` first and check that the snippets it picks are the right models, DTOs and controllers. If they aren't, add `keywords` (legacy table names help a lot) or set `include` globs for that repo.
5. Run `analyze --dry-run` and skim `prompt.txt`, then run `analyze`.

`mediator.config.json` is gitignored, so each machine keeps its own paths.

## Config

```jsonc
{
  "model": "claude-opus-5-5",
  "effort": "high",
  "backendBudgetChars": 200000,
  "repos": [{ "name": "monorepo", "path": "../my-app", "include": ["optional globs"], "exclude": [] }],
  "features": {
    "add-product": {
      "description": "One-line context for the model",
      "figma": { "fileKey": "abc123", "nodeIds": ["1:2"] },   // or "designFile": "path/to/export.json"
      "repos": ["monorepo"],                                   // defaults to all repos
      "keywords": ["item", "tbl_item"]                         // legacy names the design won't mention
    }
  }
}
```

`fileKey` and `nodeIds` come from a Figma URL: `figma.com/design/<fileKey>/...?node-id=1-2` → `"1:2"`. Point it at a section or page to pick up every frame inside, or at a single frame.

`designFile` accepts a Figma `/nodes` response, a single node, or an already-normalized `{ "screens": [...] }`. That last form lets you produce the spec some other way, e.g. by asking Claude Code with the Figma MCP to fill it in.

## Ideas for next steps

- **Expose it as an MCP server** (`analyze_feature`, `get_design_spec`, `scan_backend`) so it can run inside Claude Code next to the Figma MCP, and so frontend devs can ask follow-up questions about a report.
- **Diff mode**: store each `analysis.json` and report only what changed since the last run, whether design edited a frame or backend merged a migration.
- **Run it on a schedule or in CI** on backend PRs, and post new blockers to Slack, Jira or Linear, tagged to the right team.
- **Better repo context** for very large monorepos: let the model ask for more files through tool use instead of relying on the keyword ranker.

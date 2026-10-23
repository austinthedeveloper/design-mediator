# Architecture

## Pipeline

```
                     mediator.config.json
                    (repos, features, model)
                              │
        ┌─────────────────────┼──────────────────────┐
        ▼                                            ▼
 ┌──────────────┐                           ┌────────────────┐
 │ Design       │  Figma REST /nodes        │ Backend scan   │  fast-glob over each repo
 │ src/design/  │  or local designFile      │ src/backend/   │
 └──────┬───────┘                           └───────┬────────┘
        │ DesignSpec                                 │
        │ (screens → fields, actions, texts)         │
        ├──────── keywords (designKeywords) ────────►│
        │                                            │ BackendSnippet[]
        │                                            │ (ranked, within budget)
        ▼                                            ▼
 ┌──────────────────────────────────────────────────────────┐
 │ Analysis: src/analyze.ts                                   │
 │ buildPrompt() → one streamed Claude call, JSON schema     │
 │ output (Zod) → Analysis                                    │
 └──────────────────────────┬───────────────────────────────┘
                            ▼
 ┌──────────────────────────────────────────────────────────┐
 │ Output: src/report.ts + src/cli.ts                        │
 │ mediator-out/<feature>/                                    │
 │   design.json  analysis.json  report.md  contract.ts  mock.json │
 └──────────────────────────────────────────────────────────┘
```

## Modules

| File | What it does |
|---|---|
| `src/cli.ts` | Parses arguments and runs the `design`, `scan` and `analyze` commands. |
| `src/server.ts` | The local web UI server (`npm run ui`): JSON API, folder browser, analysis jobs. |
| `ui/index.html` | The web UI. One HTML file with plain JS and no build step. |
| `src/pipeline.ts` | The three stages plus writing output files. The CLI and the server both call this. |
| `src/config.ts` | Loads, validates and saves `mediator.config.json`, and resolves paths relative to it. |
| `src/credentials.ts` | Anthropic and Figma keys: environment variables first, then `~/.design-mediator/credentials.json`. |
| `src/types.ts` | Shared types: `DesignSpec`, `DesignField`, `BackendSnippet`, the config shape. |
| `src/design/figma.ts` | Fetches Figma nodes and turns frames into screens with fields, actions and copy. |
| `src/design/index.ts` | Picks the design source (Figma or a file) and pulls search keywords out of the design. |
| `src/backend/scan.ts` | Finds schema-like files, splits them into declarations and scores them against the keywords. |
| `src/backend/index.ts` | Scans every repo the feature uses and picks snippets within the character budget. |
| `src/analyze.ts` | The analysis schema (Zod), the system prompt, building the prompt, and the Claude call. |
| `src/report.ts` | Renders `Analysis` as a markdown report. |

## Web UI

```
browser (ui/index.html) ──JSON──► src/server.ts (127.0.0.1 only) ──► pipeline.ts / config.ts / credentials.ts
```

- **API**: `GET/PUT /api/config` · `GET/PUT /api/credentials`, plus `POST /api/credentials/test` · `GET /api/fs?path=&files=json` · `POST /api/features/:name/{design,scan,analyze}` · `GET /api/features/:name/last-run` · `GET /api/jobs/:id`.
- **Analysis runs as a job.** `analyze` returns a job id right away. The page polls `/api/jobs/:id` every 1.5 s for progress lines, then loads `last-run`. Jobs live only in memory, so if the server restarts the page falls back to the last saved run on disk.
- **Keys never go back to the browser.** It only gets whether a key is set, where it came from (env or file), and the last 4 characters.
- **Local-only safeguards**: the server listens on `127.0.0.1` only, rejects any `Host` header other than `localhost` or `127.0.0.1` (this blocks DNS-rebinding attacks), and requires `content-type: application/json` on writes, which a cross-site form can't send.
- **Folder browser**: the server lists folders (and `.json` files when asked). Browsers don't give web pages real file paths, so the server does the browsing.

See [ADR 0008](adr/0008-local-web-ui.md).

## Stage details

### 1. Design extraction

- **Input**: a Figma `/v1/files/:key/nodes` response, a single node, or a `{ screens: [...] }` spec that's already normalized.
- **Screens**: each `FRAME` under a requested `SECTION` or `CANVAS`, or the requested node itself.
- **Fields**: any non-text node whose name matches input-like words (`input`, `select`, `toggle`, `upload`, `currency`…). The label, placeholder and helper text come from Figma component properties first, then from text layer names, then from the first text inside.
- **Required**: a trailing `*` on the label, or a boolean component property named `required`.
- **Kind**: guessed from the component name, the label and the placeholder (`currency`, `multiselect`, `image`…).
- **Actions**: text inside nodes named `button`, `btn` or `cta`.
- **Texts**: every other bit of copy on the screen, kept as context for the model.

The heuristics don't have to be perfect, because Claude also sees component names and leftover copy. See [ADR 0003](adr/0003-heuristics-plus-llm.md).

### 2. Backend scan

- **Files**: default globs for Prisma, SQL, GraphQL, OpenAPI, and files or folders named like models, entities, DTOs, schemas, controllers, routes or migrations. Tests, build output and `node_modules` are excluded. Each repo can override `include` and `exclude`.
- **Blocks**: a file is split at declarations (`model`, `enum`, `class`, `interface`, `CREATE TABLE`…) and route markers (`@Get`, `router.post(`…). A block ends at its matching closing brace, at `;` in SQL, or when the indentation drops in Python. Files with no declarations are split into 60-line windows.
- **Scoring**: keyword hits after splitting camelCase and snake_case, plus 3× hits in the file path.
- **Selection**: highest scores first, until `backendBudgetChars` (default 200k characters) is reached. The picked snippets are then put back in file order.

### 3. Analysis

- One `client.beta.messages.stream(...)` call to `claude-opus-5-5` with effort set in the config (default `high`).
- `output_config.format` is built from the Zod `AnalysisSchema`, so the response is guaranteed to parse.
- Server-side fallback (`fallbacks: "default"`) re-runs the request on another model if Opus declines it.
- A refusal, a hit on `max_tokens`, or output that fails the schema each throw a clear error.
- The prompt is made of XML-tagged parts: `<feature>`, `<design>` (the JSON screens), and `<backend_code>` with one `<snippet source="repo/path:start-end">` per snippet.

### 4. Output

| File | Purpose |
|---|---|
| `design.json` | What was extracted from the design. Useful for checking the heuristics. |
| `prompt.txt` | Only written with `--dry-run`: the exact prompt that would be sent. |
| `analysis.json` | The raw structured result, for diffing or other tools to read. |
| `report.md` | The human-readable report. |
| `contract.ts` / `mock.json` | A draft API contract and sample response for frontend. |

## Data model (`Analysis`)

- `summary`
- `entities[]`: name, sources, notes
- `fields[]`: screen, design label and type, backend field and type, source, `status` (`matched` · `missing_in_backend` · `missing_in_design` · `type_mismatch` · `validation_mismatch` · `naming_mismatch` · `unclear`), notes
- `endpoints[]`: method, path, purpose, `status` (`exists` · `needs_change` · `missing`), source, notes
- `questionsForDesign[]` / `questionsForBackend[]`: question, why, `priority` (`blocker` · `high` · `low`)
- `risks[]`
- `frontendContract`: `typescript`, `mockJson`

## Known limitations

- **Keyword ranking can miss code** whose names share nothing with the design, such as legacy abbreviations. The workaround is `keywords` in the config. See [idea: agentic repo exploration](ideas/agentic-repo-exploration.md).
- **Large OpenAPI files** are split into 60-line windows, which can cut a schema in half.
- **Figma**: variants inside component sets, auto-layout repeats (lists of the same field), and hidden-but-relevant states such as error variants aren't handled specially.
- **Citations depend on the model.** The prompt tells Claude to cite only what it was shown, but nothing checks the line numbers yet. See story S-21.
- **One feature per run**, and no memory between runs. See [idea: diff mode](ideas/diff-mode.md).
- **No automated tests yet.** Everything so far was checked by hand against `examples/`.

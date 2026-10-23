# Backlog

**Legend:** ✅ done and verified · 🟡 built, not yet verified against real Figma or the real API · ⬜ to do · ⭐ next up

## Summary

| ID | Story | Epic | Status |
|---|---|---|---|
| S-01 | CLI scaffold with `design` / `scan` / `analyze` | Foundation | ✅ |
| S-02 | Config file for repos and features | Foundation | ✅ |
| S-03 | Example design and legacy monorepo with planted gaps | Foundation | ✅ |
| S-04 | Private GitHub repo and setup docs for another machine | Foundation | ✅ |
| S-05 | Fetch frames from the Figma REST API | Design | 🟡 |
| S-06 | Load a local design export or normalized spec | Design | ✅ |
| S-07 | Pull fields, actions and copy out of frames | Design | ✅ |
| S-08 | Handle component sets and variants | Design | ⬜ |
| S-09 | Detect repeated fields and lists | Design | ⬜ |
| S-10 | Send frame screenshots to Claude | Design | ⬜ |
| S-11 | Find schema-like files and split them into declarations | Backend | ✅ |
| S-12 | Rank snippets by design keywords within a budget | Backend | ✅ |
| S-13 | Scan more than one repo per feature | Backend | 🟡 |
| S-14 | Understand OpenAPI files by schema and path | Backend | ⬜ |
| S-15 | Let the model explore the repo with tools | Backend | ⬜ |
| S-16 | Structured gap analysis with Claude | Analysis | 🟡 |
| S-17 | Stream the call and handle refusal and fallback | Analysis | 🟡 |
| S-18 | `--dry-run` that writes the prompt | Analysis | ✅ |
| S-19 | First real run on the actual monorepo | Analysis | ⬜ ⭐ |
| S-20 | Show token usage and cost per run | Analysis | ⬜ |
| S-21 | Check citations against the snippets that were sent | Analysis | ⬜ |
| S-22 | Markdown gap report | Output | ✅ |
| S-23 | Write `contract.ts` and `mock.json` | Output | 🟡 |
| S-24 | Diff mode: report only what changed since the last run | Output | ⬜ |
| S-25 | Generate MSW handlers from the contract | Output | ⬜ |
| S-26 | MCP server for Claude Code | Integration | ⬜ |
| S-27 | Run in CI or on a schedule | Integration | ⬜ |
| S-28 | Send questions to Slack, Jira or Linear | Integration | ⬜ |
| S-29 | Unit tests for the extractor and scanner | Quality | ⬜ ⭐ |
| S-30 | Eval set of known gaps to measure analysis quality | Quality | ⬜ |
| S-31 | Local web UI: setup, features, run | Web UI | ✅ |
| S-32 | Save keys from the UI, with a Test button | Web UI | 🟡 |
| S-33 | Folder browser for repos and design files | Web UI | ✅ |
| S-34 | Analysis results page | Web UI | ✅ |
| S-35 | Live streaming progress and a Cancel button | Web UI | ⬜ |
| S-36 | Run history per feature in the UI | Web UI | ⬜ |

---

## Epic: Foundation

### S-01 · CLI scaffold ✅
As a frontend dev, I want one command per stage so I can check each step on its own.
- [x] `design <feature>` prints the extracted `DesignSpec`
- [x] `scan <feature>` prints keywords and the ranked snippets
- [x] `analyze <feature>` writes the report folder
- [x] Runs with `npm run mediator --` and needs no build step

### S-02 · Config file ✅
As a user, I want to define repos and features in one file so each run is a single command.
- [x] `repos[]` with `path`, plus optional `include` / `exclude`
- [x] `features{}` with `figma` or `designFile`, `repos`, `keywords`, `description`
- [x] Paths resolve relative to the config file
- [x] Clear error for an unknown feature or a missing repo path

### S-03 · Example fixtures ✅
As a developer of this tool, I want sample data with known gaps so I can test without real access.
- [x] Two-screen "Add Product" Figma export
- [x] Fake monorepo: Prisma model, NestJS DTO and controller, legacy SQL, plus one unrelated file
- [x] Planted gaps: fields missing in the backend, a required backend field missing in the design, cents vs dollars, a toggle vs an enum

### S-04 · Portable setup ✅
As the owner, I want to clone the tool onto the computer where the monorepo lives.
- [x] Private GitHub repo
- [x] README section on pointing it at your own monorepo
- [x] Per-machine config is gitignored ([ADR 0007](../adr/0007-local-config.md))

## Epic: Design ingestion

### S-05 · Figma REST fetch 🟡
As a frontend dev, I want to point at Figma node ids instead of exporting files by hand.
- [x] `GET /v1/files/:key/nodes` with `FIGMA_TOKEN`
- [x] A `SECTION` or `CANVAS` node expands to its frames
- [ ] Tested against a real Figma file
- [ ] Friendly error for a 403 or 404 that says which token or file is wrong

### S-06 · Local design file ✅
- [x] Accepts a `/nodes` response, a single node, or `{ screens: [...] }`

### S-07 · Field extraction heuristics ✅
- [x] Fields detected from component names (input, select, toggle, upload, currency…)
- [x] Label, placeholder and helper from component properties, then layer names, then the first text
- [x] Required from a trailing `*` or a `required` boolean property
- [x] Kind guessed from component name, label and placeholder
- [x] Buttons become `actions`. Other copy becomes `texts`.
- [ ] Tuned against the team's real design system (part of S-19)

### S-08 · Component sets and variants ⬜
As a frontend dev, I want error, disabled and empty states picked up so validation rules show up in the analysis.
- [ ] Read variant properties (`State=Error`) and attach error copy to the field as validation hints
- [ ] Don't count the same field twice when several variants are on the canvas

### S-09 · Repeated fields and lists ⬜
As a frontend dev, I want "add another variant" and table rows recognized as arrays, not as separate fields.
- [ ] Detect repeated sibling structures and mark them as `array` with an item shape
- [ ] Table headers become columns of a list endpoint

### S-10 · Screenshots to Claude ⬜
See [ideas/design-screenshots.md](../ideas/design-screenshots.md).

## Epic: Backend discovery

### S-11 · File discovery and block splitting ✅
- [x] Default globs for Prisma, SQL, GraphQL, OpenAPI, and model/DTO/controller naming
- [x] Splits on declarations and route decorators. Ends blocks by brace, `;` or indentation.
- [x] 60-line windows when a file has no declarations

### S-12 · Keyword ranking and budget ✅
- [x] Keywords from the feature name, screen names, field labels and config `keywords`
- [x] camelCase and snake_case are split before matching. Path hits count 3×.
- [x] Highest scores first, until `backendBudgetChars`

### S-13 · Multiple repos 🟡
- [x] `repos[]` and a per-feature `repos` filter
- [x] Snippets cited as `repo/path:line`
- [ ] Tested with two or more real repos

### S-14 · OpenAPI-aware parsing ⬜
As a frontend dev, I want only the relevant parts of a large spec, not 60-line slices that cut schemas in half.
- [ ] Parse JSON and YAML specs. Turn each `components.schemas` entry and each path operation into its own snippet.
- [ ] Resolve `$ref` one level deep for the snippets that get picked

### S-15 · Agentic repo exploration ⬜
See [ideas/agentic-repo-exploration.md](../ideas/agentic-repo-exploration.md).

## Epic: Analysis

### S-16 · Structured gap analysis 🟡
- [x] Zod `AnalysisSchema` sent as `output_config.format`
- [x] System prompt: cite only code it was shown, ignore system-managed fields, one decision per question
- [x] Ran end to end against a stubbed API
- [ ] Ran against the real API (S-19)

### S-17 · Streaming, refusal and fallback 🟡
- [x] Streams with `max_tokens: 64000` and reads `parsed_output` from `finalMessage()`
- [x] `fallbacks: "default"` ([ADR 0006](../adr/0006-streaming-and-fallbacks.md))
- [x] Clear errors for `refusal`, `max_tokens` and a schema mismatch

### S-18 · Dry run ✅
- [x] `--dry-run` writes `prompt.txt` and `design.json` without calling Claude

### S-19 · First real run ⬜ ⭐
As the owner, I want to run it on a real feature in the real monorepo so we know whether the output is useful.
- [ ] `scan` picks the right models, DTOs and routes (tune `keywords` and `include` until it does)
- [ ] `analyze` finishes. Note the time and token use.
- [ ] Check the report by hand: how many findings are right, wrong or missing?
- [ ] Turn what we learn into issues or updates to the ADRs

### S-20 · Usage and cost reporting ⬜
- [ ] Print input, output and cache token counts and an estimated cost after `analyze`
- [ ] Save them in `analysis.json` under a `meta` key

### S-21 · Citation check ⬜
As a reader of the report, I want to know that every `file:line` really points at code that was sent.
- [ ] Check each `source` against the snippets' paths and line ranges
- [ ] Mark citations that don't match in the report (⚠️ unverified)

## Epic: Output

### S-22 · Markdown report ✅
- [x] Summary, a count for each status, field matrix, endpoints, questions sorted by priority, risks, entities, contract

### S-23 · Contract and mock files 🟡
- [x] `contract.ts` and `mock.json` written next to the report
- [ ] Check that `contract.ts` type-checks on its own, and save a warning if it doesn't

### S-24 · Diff mode ⬜
See [ideas/diff-mode.md](../ideas/diff-mode.md).

### S-25 · MSW handlers ⬜
- [ ] Generate a `handlers.ts` for MSW from the contract's endpoints and `mock.json`

## Epic: Integration

### S-26 · MCP server ⬜
See [ideas/mcp-server.md](../ideas/mcp-server.md).

### S-27 · CI or scheduled runs ⬜
See [ideas/ci-and-notifications.md](../ideas/ci-and-notifications.md).

### S-28 · Send questions to team tools ⬜
See [ideas/ci-and-notifications.md](../ideas/ci-and-notifications.md).

## Epic: Quality

### S-29 · Unit tests ⬜ ⭐
- [ ] Extractor: fixtures for component properties, layer names, the `*` required marker, guessing kinds, hidden nodes
- [ ] Scanner: block splitting for Prisma, SQL, TypeScript and Python. Scoring with camelCase and snake_case.
- [ ] Report: renders with an empty `Analysis` and with a full one
- [ ] `npm test` passes before any commit

### S-30 · Eval set ⬜
As the owner, I want to know if a prompt or model change made the analysis better or worse.
- [ ] 3–5 fixture features with a hand-written list of expected gaps
- [ ] A script that scores recall and precision of `fields[].status` against the expected list

## Epic: Web UI

### S-31 · Local web UI ✅
As a frontend dev, I want to set up and run the mediator from a browser page instead of editing JSON and exporting variables.
- [x] `npm run ui` starts a server on 127.0.0.1 and opens the browser ([ADR 0008](../adr/0008-local-web-ui.md))
- [x] Setup, Features and Run tabs. Reads and writes the same `mediator.config.json` as the CLI.
- [x] Figma links are parsed into file key and node id, with an inline error when the link has no node
- [x] Previews of the design and the backend scan before running an analysis
- [x] Works at phone width with no sideways scrolling, and follows the system light or dark theme
- [x] Rejects foreign `Host` headers and writes that aren't JSON

### S-32 · Credentials from the UI 🟡
- [x] Save, replace and remove the Anthropic key and Figma token. Stored in `~/.design-mediator/credentials.json` with mode 600.
- [x] Shows where each key comes from (env or saved) and only its last 4 characters
- [x] Anthropic Test calls the Models API and explains 401, 403, 404, 429 and connection errors in plain words (checked with a fake key, which got a real 401)
- [ ] Test succeeds with a real Anthropic key
- [ ] Figma Test (`/v1/me`) checked with a real token

### S-33 · Folder browser ✅
- [x] Browse from the home folder, go up a level, jump home, or type a path
- [x] Git repos are tagged. Hidden folders and `node_modules` are skipped.
- [x] `.json` file picking for local design exports
- [x] Adding a repo names it after the folder. Renaming or removing it updates the features that use it.

### S-34 · Results page ✅
- [x] Loads the last finished analysis for the selected feature
- [x] Summary, a field table with a status filter, endpoints, questions sorted by priority, risks, contract
- [x] Copy buttons for questions, `contract.ts` and `mock.json`. Download `report.md`.
- [x] Analysis runs as a background job with progress lines. Errors are shown with the log.
- [ ] Shown with a real (not sample) analysis (S-19)

### S-35 · Live progress and cancel ⬜
- [ ] Stream the model's progress (for example "fields mapped so far") instead of three fixed steps
- [ ] Cancel a running analysis, aborting the API request

### S-36 · Run history ⬜
- [ ] List past runs per feature and open any of them (pairs with [diff mode](../ideas/diff-mode.md))

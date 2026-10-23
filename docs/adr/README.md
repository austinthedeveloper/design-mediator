# Architecture decision records

Short records of decisions that shape the project: the context, what was decided, and the cost. Add a new one when a decision would surprise someone reading the code later. Copy [template.md](template.md) and take the next number.

| # | Decision | Status |
|---|---|---|
| [0001](0001-typescript-cli.md) | Build a TypeScript CLI, not a server or web app | Accepted |
| [0002](0002-figma-rest-api.md) | Read designs through the Figma REST API, with local files as a fallback | Accepted |
| [0003](0003-heuristics-plus-llm.md) | Extract fields with cheap heuristics, then let the model resolve them | Accepted |
| [0004](0004-keyword-ranked-snippets.md) | Pick backend context by keyword-ranked snippets within a budget | Accepted, revisit |
| [0005](0005-single-structured-call.md) | One structured-output Claude call per feature | Accepted |
| [0006](0006-streaming-and-fallbacks.md) | Stream the call and opt into server-side fallback | Accepted |
| [0007](0007-local-config.md) | Keep per-machine config in a gitignored JSON file | Accepted, amended by 0008 |
| [0008](0008-local-web-ui.md) | Add a local web UI, with keys stored in the user's home folder | Accepted |

# Idea: Agentic repo exploration

## Problem

Keyword ranking ([ADR 0004](../adr/0004-keyword-ranked-snippets.md)) misses code whose names don't overlap with the design: legacy tables called `tbl_item`, services named after an old product, validation in a shared package. When that happens the model marks fields `missing_in_backend` that actually exist. That's the worst kind of mistake, because it sends backend chasing work they've already done.

## Proposal

Keep the keyword-ranked snippets as a starting point, and also give the model read-only tools:

- `grep(pattern, glob?)`: matching lines with `file:line`
- `read_file(path, startLine?, endLine?)`: limited to the configured repos
- `list_dir(path)`

Run it with the SDK's tool runner. Cap it with a task budget, so the model stops exploring and writes its answer when the budget runs low. The final answer still uses `AnalysisSchema`.

Prompt rule: before marking anything `missing_in_backend`, do at least one search for it.

## Open questions

- Cost and time. Expect 3–10× the single call. Maybe make it a `--deep` flag, or only re-check the fields the first pass marked `missing_in_backend` or `unclear`.
- Paths: tool inputs must be resolved and kept inside the repo roots.
- Should it be built on the Claude Agent SDK instead, which already has grep, read and glob? That gives less control over the output and adds a heavier dependency.

## Size

L.

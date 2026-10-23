# 0004. Pick backend context by keyword-ranked snippets within a budget

- **Status**: Accepted, revisit after real-world runs
- **Date**: 2026-10-22

## Context

A monorepo can be far bigger than any useful prompt, and most of it has nothing to do with the feature. We need the models, DTOs, routes and legacy tables for this one feature.

## Decision

- Glob for schema-like files (see `DEFAULT_INCLUDE`).
- Split each file into declarations and route blocks.
- Score each block by keyword hits, where the keywords come from the design plus any `keywords` in the config. Hits in the file path count 3×.
- Take the highest scores until `backendBudgetChars` is reached (default 200k characters, roughly 50k tokens).
- Cite every snippet as `repo/path:start-end` so the model can cite it back.

## Consequences

- Fast, cheap, has no dependencies, and gives the same result every run. `mediator scan` makes the selection visible.
- Misses code whose names don't overlap with the design, for example `tbl_item` vs "Product". The workaround is `keywords`. The long-term fix is to let the model ask for files itself. See [ideas/agentic-repo-exploration.md](../ideas/agentic-repo-exploration.md).
- Revisit once we've run it on the real monorepo and seen how often it misses.

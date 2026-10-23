# 0002. Read designs through the Figma REST API, with local files as a fallback

- **Status**: Accepted
- **Date**: 2026-10-22

## Context

The starting idea was to use the Figma MCP server. That MCP is designed for an AI assistant in an editor: it returns generated code and screenshots for whatever is selected in Figma. A CLI needs repeatable, structured access to specific frames without a person clicking around.

## Decision

- Call `GET /v1/files/:key/nodes?ids=...` with a personal access token in `FIGMA_TOKEN`.
- Also accept a local `designFile`: a saved `/nodes` response, a single node, or a `DesignSpec` that's already normalized.

## Consequences

- Runs headless and gives the same result for the same frames, so it works in CI later.
- The normalized-spec path is a way into the Figma MCP workflow: Claude Code with the Figma MCP can write `{ "screens": [...] }` and the tool takes it from there.
- The REST tree has no visual context. Screenshots could be added later through the `/images` endpoint. See [ideas/design-screenshots.md](../ideas/design-screenshots.md).
- Each user needs a Figma token with read access to the file.

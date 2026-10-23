# 0001. Build a TypeScript CLI, not a server or web app

- **Status**: Accepted
- **Date**: 2026-10-22

## Context

The first users are frontend developers who want an answer for one feature at a time. The tool has to read a monorepo on a developer's machine, and that monorepo is on a different computer from where the tool was written. Frontend teams already have Node installed.

## Decision

A Node 20+ CLI written in TypeScript, run with `tsx` so there's no build step. Commands: `design`, `scan`, `analyze` (with `--dry-run`). Dependencies are kept to three: `@anthropic-ai/sdk`, `zod`, `fast-glob`.

## Consequences

- Easy to clone and run anywhere the monorepo is. No hosting, no auth, no database.
- Each stage can be run and checked on its own, which matters while the heuristics are still being tuned.
- Results aren't shared automatically. Someone has to pass the report around. A server, an MCP server or a CI job can wrap the same modules later. See [ideas/mcp-server.md](../ideas/mcp-server.md) and [ideas/ci-and-notifications.md](../ideas/ci-and-notifications.md).

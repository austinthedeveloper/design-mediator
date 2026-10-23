# 0007. Keep per-machine config in a gitignored JSON file

- **Status**: Accepted
- **Date**: 2026-10-22

## Context

The tool is written on one computer and used on another, where the monorepo lives. Repo paths and Figma file keys are different on each machine and for each team.

## Decision

- `mediator.config.json` is gitignored. `mediator.config.example.json` is committed and points at `examples/`.
- Paths in the config resolve relative to the config file. Absolute paths work too.
- Secrets come only from environment variables (`ANTHROPIC_API_KEY` or an `ant auth login` profile, and `FIGMA_TOKEN`), never from the config.

## Consequences

- Cloning and running never leaks one machine's paths or keys.
- Feature definitions aren't shared between people. If a team wants shared feature lists, add a committed `features/*.json` layer on top later.

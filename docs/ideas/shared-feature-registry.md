# Idea: Shared feature registry

## Problem

`mediator.config.json` is per machine ([ADR 0007](../adr/0007-local-config.md)), so every developer defines "add-product" again. Knowing which Figma frames and which code belong to a feature is useful to the whole team, not just this tool.

## Proposal

- A committed `features/` folder, either in this repo or in the monorepo: one `add-product.json` per feature with Figma file and node ids, a description, and keywords.
- The local config keeps only machine-specific things (repo paths, model, budget) and points at the features folder.
- Optional: put the feature files in the monorepo itself, so backend sees which features depend on the code they're changing.

## Open questions

- Should it live in this repo or the monorepo? The monorepo is better for visibility. This repo is simpler.

## Size

S.

# Idea: CI and notifications

## Problem

Even with the report, frontend still carries the questions to design and backend by hand. The aim is for gaps to reach the people who own them.

## Proposal

**Triggers**
- A backend PR that touches the schema, DTOs or migrations: run `analyze` for the affected features and comment on the PR with the deltas from diff mode. ("This PR resolves 2 gaps for add-product and introduces 1: `weightGrams` is now required but not in the design.")
- A nightly schedule: catch design changes, since Figma has no PR to hook into. Figma webhooks (`FILE_UPDATE`) could replace polling later.

**Destinations**
- `questionsForBackend` with priority `blocker` or `high` → Jira or Linear tickets in the backend project, linked to the cited code.
- `questionsForDesign` → a Figma comment on the node (the API supports node-anchored comments) or a design Slack channel.
- A short summary → the frontend Slack channel.

## Open questions

- Avoiding duplicates: match against tickets that are already open (needs diff mode).
- Noise: start with blockers only, and require a person to approve before anything is created.
- Access: a CI job needs a Figma token and an Anthropic key stored as secrets.

## Size

M, and it depends on diff mode.

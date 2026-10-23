# 0005. One structured-output Claude call per feature

- **Status**: Accepted
- **Date**: 2026-10-22

## Context

The output has to feed a report, contract files, and later diffing and notifications. Free-form text would need parsing and would drift between runs. An agent loop with tools would be more flexible but slower, more expensive and harder to predict.

## Decision

Make one `messages` call with `output_config.format` built from a Zod schema (`AnalysisSchema`), on `claude-opus-5-5` (configurable). Status and priority fields are enums so they can be grouped and filtered. The system prompt sets the ground rules: cite only code you were shown, ignore fields the system manages (ids, timestamps), and ask one decision per question.

## Consequences

- The output always parses, and `analysis.json` can be diffed and read by other tools.
- Cost and time are predictable: one request per feature.
- The model can't ask for more code partway through. If context is missing, it has to mark fields `unclear`. The fix for that is agentic exploration (see ADR 0004).
- Changing the schema changes `analysis.json`, so anything that reads it later (diff mode) will need a version field.

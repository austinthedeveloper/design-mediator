# Idea: Diff mode

## Problem

Design keeps changing and backend keeps migrating. A full report every time is noisy. What frontend wants each week is: "2 new gaps, 3 resolved, design renamed 'Compare-at price'".

## Proposal

- Save each run as `mediator-out/<feature>/history/<timestamp>/analysis.json`, along with a hash of the design spec and of the snippets that were sent.
- If neither hash changed, skip the Claude call. "No changes" costs nothing.
- Otherwise, match the new fields to the old ones by `(designLabel, backendField)` and sort them into **new**, **resolved**, **changed status** and **unchanged**.
- Write `changes.md` with only the deltas. Also put a "since last run" section at the top of `report.md`.

## Open questions

- How should a renamed label be matched? A fuzzy match on label plus Figma `nodeId` is probably good enough.
- The model may word the same finding differently between runs. The matching has to key on structured fields, not on notes text.
- `analysis.json` needs a `schemaVersion` so old runs can still be read when the schema changes (see [ADR 0005](../adr/0005-single-structured-call.md)).

## Size

M.

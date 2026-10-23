# 0003. Extract fields with cheap heuristics, then let the model resolve them

- **Status**: Accepted
- **Date**: 2026-10-22

## Context

Every design system names its components differently. A full Figma parser that understands every team's components would take a long time and still break. On the other hand, sending raw Figma JSON to the model is huge and noisy: positions, styles, vectors.

## Decision

Pull out a small `DesignSpec` with regex heuristics on node names, component properties and text layers. Keep the component name and any leftover copy on each screen, so the model can fix wrong guesses (for example, a "Stepper" component that the heuristics typed as `unknown`).

## Consequences

- The prompt stays small and readable. `mediator design <feature>` shows exactly what was extracted.
- Good-enough extraction works on day one. Teams can make it better by naming components consistently, or by adding patterns to `FIELD_PATTERN` and `inferKind`.
- Some fields will be missed, for example custom components with unusual names. The `texts` list keeps their labels visible to the model as a backstop.

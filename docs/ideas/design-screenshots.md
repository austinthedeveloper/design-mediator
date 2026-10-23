# Idea: Design screenshots

## Problem

The Figma node tree loses things a person sees right away: which fields are grouped together, which are in a modal, what's greyed out, the meaning of an icon with no label. The heuristics ([ADR 0003](../adr/0003-heuristics-plus-llm.md)) also miss custom components.

## Proposal

- Call Figma `GET /v1/images/:key?ids=<frameIds>&format=png&scale=1` for each screen.
- Send the images to Claude next to the `DesignSpec` JSON, one image per screen with its name.
- Add to the prompt: "If the image shows a field that isn't in the spec, add it with `designType` from what you see."
- With `designFile` (no Figma access), allow optional `screenshots/<screen>.png` files next to it.

## Open questions

- Image tokens: around 1–2k per screen at scale 1, which is fine for a handful of screens.
- Should the image or the spec win when they disagree? Probably report both, with status `unclear`.

## Size

S.

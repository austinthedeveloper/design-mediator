# 0006. Stream the call and opt into server-side fallback

- **Status**: Accepted
- **Date**: 2026-10-22

## Context

The analysis can be long (the field matrix plus the contract plus mocks) and Opus thinks before it answers. The first version used a non-streaming `parse()` call with a large `max_tokens`. The SDK refused it: "Streaming is required for operations that may take longer than 10 minutes." Separately, Claude Opus 5.5 can decline some requests through its safety classifiers. Those declines are rare for this kind of work, but a declined run would leave frontend with nothing.

## Decision

- Use `client.beta.messages.stream(...)` with `max_tokens: 64000` and read `parsed_output` from `finalMessage()`.
- Send `betas: ["server-side-fallback-2026-07-01"]` and `fallbacks: "default"`, so a declined request is retried on Anthropic's recommended fallback model inside the same call.
- Check `stop_reason` for `refusal` and `max_tokens` before trusting the output.

## Consequences

- No request timeouts on long analyses.
- The fallback only works on the Claude API directly. On Bedrock, Vertex or Foundry it would need the SDK's client-side middleware instead.
- To turn it off, delete the `betas` and `fallbacks` lines in `src/analyze.ts`.

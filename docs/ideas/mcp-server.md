# Idea: MCP server

## Problem

The starting vision was "Figma MCP + AI + repo". Today the tool is a standalone CLI. Frontend devs already work in Claude Code, often with the Figma MCP connected, and they'd rather ask "what's missing for the Add Product screen?" there than switch to a terminal and open a report.

## Proposal

Wrap the existing modules in an MCP server (stdio) with these tools:

| Tool | Wraps | Returns |
|---|---|---|
| `list_features` | config | feature names and descriptions |
| `get_design_spec(feature)` | `loadDesign` | `DesignSpec` |
| `scan_backend(feature, extraKeywords?)` | `scanBackend` | ranked snippet list |
| `analyze_feature(feature)` | full pipeline | `Analysis` and the report path |
| `get_report(feature)` | `mediator-out/` | the last report |

Claude Code could then:
- Use the Figma MCP to look at a frame, then call `analyze_feature`.
- Answer follow-ups ("which questions are blockers?", "write the form with the contract") using the report as context.
- Read the cited files itself to double-check a finding.

A step further: an `analyze_spec(spec)` tool that takes a `DesignSpec` built live from the Figma MCP, so no Figma token or config entry is needed.

## Open questions

- Should `analyze_feature` call Claude itself (nested model call), or return the prompt for the host session's model to reason over? Calling Claude itself keeps the output consistent. Returning the prompt avoids paying twice.
- Should the config file be required, or should repo paths come from the host's working directory?

## Size

M. The modules are already separate. Most of the work is tool schemas and error handling.

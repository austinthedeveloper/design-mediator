# 0008. Add a local web UI, with keys stored in the user's home folder

- **Status**: Accepted
- **Date**: 2026-10-23

## Context

Setting up the CLI meant editing JSON by hand and exporting environment variables. The owner asked for a Browse button for repos and a place to paste the API key. The tool will run on a different computer from the one it was built on, by people who may not live in a terminal.

## Decision

- `npm run ui` starts a small Node `http` server on `127.0.0.1` (port 4777, or the next free one) and opens the browser. No framework and no new dependencies.
- The page is a single `ui/index.html` with plain JavaScript, so there's no build step. All text from the analysis is inserted as text, never as HTML.
- The CLI and the server share `src/pipeline.ts`, so both behave the same.
- Keys are saved to `~/.design-mediator/credentials.json` with mode 600 (folder 700). Environment variables still take precedence. The browser never receives a full key.
- Folder picking happens on the server, because browsers don't give web pages real file paths.
- Local-only safeguards: bind to the loopback address, check the `Host` header, require JSON bodies on writes.

## Alternatives considered

- **Electron or Tauri desktop app**: native folder dialogs and the OS keychain, but a much heavier install and build for the same features. We can come back to it if the UI needs to be a double-click app.
- **OS keychain for keys** (macOS Keychain and others): safer at rest, but needs a native dependency or a different command on each platform. A user-only file is the same approach many developer CLIs use.

## Consequences

- Setting up repos, keys and features takes a few clicks, and the previews make it easy to fix the setup before paying for an analysis.
- Analysis jobs live in memory. Restarting the server mid-run loses progress, but finished runs are on disk.
- Anyone logged in as the same user on that computer can read the key file. That's acceptable for a developer machine. If it isn't, use environment variables instead.

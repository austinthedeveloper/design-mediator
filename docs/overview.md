# Overview

## The problem

A new application is being built by three groups that move at different speeds:

| Team | What they're doing | Where it hurts |
|---|---|---|
| **Design** | Builds Figma mocks straight ahead, adding and changing fields as the product takes shape. | Doesn't see which fields the backend can't support yet. |
| **Backend** | Migrating an older system to a new API. Their focus is the migration, not every design change. | Fields get dropped, renamed or changed in type during the migration, and design doesn't find out. |
| **Frontend** | Builds screens from the designs against the backend's API. | Ends up as QA for backend and as the go-between with design. Blocked whenever the two disagree. |

Frontend finds the gaps last, one field at a time, while building. Each gap turns into a Slack thread, a meeting, or a hard-coded workaround.

## The idea

Give frontend a tool that reads both sides and writes down the gap **before** they start building a feature:

1. Pull the screens for a feature from Figma.
2. Find the backend code that relates to it in the monorepo (or several repos): models, migrations, DTOs, controllers, legacy tables.
3. Have Claude compare the two and produce:
   - every design field mapped to a backend field, or flagged as missing or mismatched, with a `file:line` citation
   - which endpoints exist, need changes, or are missing
   - questions for design and questions for backend, each one decision, ranked by priority
   - a draft TypeScript contract and mock data, so frontend can build now and swap in the real API later

The report is something frontend can paste into a ticket or bring to a meeting. It turns "I think this is missing?" into a list with citations.

## Goals

- Unblock frontend on a new feature within minutes of the designs landing.
- Make every claim checkable: cite code locations, never assume a field exists.
- Work with a real monorepo, including legacy code that's still in the repo.
- Stay cheap to run and easy to adopt: one CLI, one config file, no server.

## Non-goals (for now)

- Replacing conversations between teams. The output is a starting point for them.
- Generating production frontend or backend code. The contract is a draft.
- Keeping Figma and the backend in sync automatically.
- Pixel-level design review (spacing, colors). This is about data and APIs.

## Who uses it

- **Frontend devs**: run it per feature, use the contract and mocks, send the questions on.
- **Tech leads**: use the report in planning to see how far apart design and backend are.
- **Design and backend**: receive the questions addressed to them. They don't need to run the tool.

## Current status

Version 0.1: a working CLI with sample data. Design extraction, backend scanning and report rendering are tested against the examples. The real Claude call has only been tested against a stubbed API, and live Figma fetching hasn't been tested yet. See [stories/backlog.md](stories/backlog.md).

# Agent Conversation Explorer

A local dev tool for browsing and debugging live agent conversations via [Azure Application Insights](https://learn.microsoft.com/en-us/azure/azure-monitor/app/app-insights-overview) telemetry. Built with React + TypeScript + Vite; not deployed anywhere.

## Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [Azure CLI](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli) — used to obtain App Insights bearer tokens
- Access to an Azure Application Insights resource that receives your agent's telemetry

## Setup

**1. Install dependencies**

```bash
npm install
```

**2. Authenticate with Azure**

```bash
az login
```

The app never talks to App Insights directly. Instead, the Express backend shells out to `az account get-access-token` to get a short-lived bearer token, which it then uses to call the App Insights query REST API. This keeps credentials out of the codebase entirely — no service principal, no API key to rotate. The token is cached in memory until near-expiry, so the CLI is only invoked when a new one is needed.

**3. Configure environment**

Copy `.env.example` to `.env.local` and fill in the values:

```bash
cp .env.example .env.local
```

| Variable | Where to find it |
|---|---|
| `TELEMETRY_CONNECTION_STRING` | Azure portal → App Insights resource → Properties → Connection String |
| `SMOKE_BUNDLE_PATH` | Absolute path to your `chat-with-agent.bundle.js` (only needed for smoke tests) |
| `SMOKE_TOKEN_ENDPOINT` | Power Platform DirectLine token endpoint for your bot (only needed for smoke tests) |

## Running

```bash
npm run dev
```

Opens the app at **http://localhost:7725**. The Express API proxy starts on port 7726.

> Re-run `az login` if you see authentication errors after a long idle period.

## What It Does

The sidebar lists recent conversations pulled from App Insights. Click any row to explore it in detail across three tabs:

**Chat** — Renders the full conversation as message bubbles. Bot messages show text (T) and voice (S) channels separately. AI-generated responses are badged.

**Execution Path** — Shows the topic flow as a collapsible tree. Each topic node lists its actions with Kind, ActionId, timestamps, and key context fields. Expand any action for the full raw JSON.

**Errors** — Lists all `OnErrorLog` events with their `customDimensions` payload. Each error links back to the relevant step in the Execution Path tab.

### Filters

The sidebar supports:
- Free-text search across conversation ID and topic names
- Phone number filter
- Channel filter (Omnichannel / IVR)
- Agent filter (multi-select)
- Time range (15 minutes → 30 days)
- Errors-only toggle

### Themes

Switch between **Midnight** (dark) and **Relax** (light) via the Settings menu in the top-right corner. The preference persists across sessions.

## Smoke Test

`test/smoke-test-caller.mjs` runs a three-turn DirectLine conversation against a live bot to verify end-to-end behaviour.

### Prerequisites

- **`test/smoke-test-caller.mjs` must exist.** This file is not checked into the repository. You need to create it (or obtain it from the team) before `npm test` will work. Running `npm test` without it will fail immediately with a "file not found" error.
- **`.env.local` must have all smoke test variables set** (`SMOKE_BUNDLE_PATH`, `SMOKE_TOKEN_ENDPOINT`, and `SMOKE_PHONE`). The test will not fall back to defaults — missing values will cause it to fail at startup.
- **`SMOKE_BUNDLE_PATH`** must point to an existing `chat-with-agent.bundle.js` on your machine. This is a local build artifact; it is not included in this repo.
- **`SMOKE_TOKEN_ENDPOINT`** must be a live, reachable Power Platform DirectLine token endpoint. The test makes real HTTP calls — there is no mock or offline mode.

### Running

```bash
npm test
```

Result JSON is written to stdout; progress logs go to stderr. Exits `0` on pass, `1` on fail.

For one-off runs against a different phone, utterance, or environment, invoke the script directly:

```bash
node test/smoke-test-caller.mjs --phone "+12125551234" --utterance "cancel my order"
```

All four values (`--phone`, `--utterance`, `--bundle-path`, `--token-endpoint`) can be passed as flags and take precedence over `.env.local`.

## License

[MIT](LICENSE)

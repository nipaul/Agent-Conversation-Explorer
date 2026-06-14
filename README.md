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

## Contributing

Contributions are welcome. Here's how to get started:

1. Fork the repo and create a branch from `main`
2. Follow the [Setup](#setup) steps to get the app running locally
3. Make your changes — keep PRs focused on a single concern
4. Open a pull request against `main` with a clear description of what changed and why

### Guidelines

- This is a local-only tool — changes that introduce server-side hosting, auth systems, or deployment config are out of scope
- The UI targets internal users comfortable with telemetry data; no need to over-simplify the interface
- Stick to the existing stack (React 18 / Vite / Express / TypeScript) — dependency additions need a good reason

### Reporting Issues

Open a GitHub issue with steps to reproduce, what you expected, and what actually happened. Including the browser console output and any errors from the Express server (`npm run dev` stderr) is especially helpful.

## License

[MIT](LICENSE)

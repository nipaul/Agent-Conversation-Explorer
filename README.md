# Agent Conversation Explorer

A local dev tool for browsing and debugging live agent conversations via [Azure Application Insights](https://learn.microsoft.com/en-us/azure/azure-monitor/app/app-insights-overview) telemetry. Built with React + TypeScript + Vite; not deployed anywhere.

## Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [Azure CLI](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli) — used to obtain App Insights bearer tokens
- Access to an Azure Application Insights resource that receives your agent's telemetry
- (Copilot Studio) If configuring a Copilot Studio agent to send telemetry, follow Microsoft's guide for connecting Copilot Studio agents to Application Insights: [Connect your Copilot Studio agent to Application Insights](https://learn.microsoft.com/en-us/microsoft-copilot-studio/advanced-bot-framework-composer-capture-telemetry#connect-your-copilot-studio-agent-to-application-insights)

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
| `LOG_PATH` | Optional. Local log file path where the server writes logs (default: `./logs/app.log`). |
| `LOG_LEVEL` | Optional. Log level for local logging (debug | info | warn | error). Default: `info`. |

## Running

```bash
npm run dev
```

Opens the app at **http://localhost:7725**. The Express API proxy starts on port 7726.

> Re-run `az login` if you see authentication errors after a long idle period.

## Local logging and rotation

A development-focused local logger persists runtime events to a file in addition to printing them to the console. Configure the behaviour via `.env.local`:

- `LOG_PATH` — path where the server writes logs (default: `./logs/app.log`).
- `LOG_LEVEL` — minimum level to persist (`debug`, `info`, `warn`, `error`). Default: `info`.

Rotation behavior:
- The logger writes to a daily rotated file by appending a date suffix to the configured path. Example: with `LOG_PATH=./logs/app.log`, today's file is `./logs/app-2026-06-15.log`.
- Retention/pruning of old files is not implemented by default; add a pruning policy if you need to limit disk usage.

Example log entry (one JSON object per line):

{"timestamp":"2026-06-15T23:00:00.123Z","level":"error","message":"Failed to query App Insights","meta":{"stack":"Error: ...","conversationId":"abc123","phone":"***"}}

> Client-side console calls are patched in development so browser console output is also forwarded to the server endpoint and persisted (sensitive fields are masked by default).

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

1. Fork the repo and create a branch from `main` using the naming convention `<type>/<short-description>` — e.g. `fix/filter-reset-on-nav` or `feat/export-conversation`
2. Follow the [Setup](#setup) steps to get the app running locally
3. Make your changes — keep PRs focused on a single concern
4. Verify `npm run build` passes before opening a PR
5. Open a pull request against `main` — the PR template will prompt you for all the required context

### Review process

- **CI** runs `npm run build` (TypeScript type-check + Vite build) on every PR. The build must be green before review begins.
- **One approval** from a code owner is required before merge.
- **Squash merge only** — each PR lands as a single atomic commit on `main`.
- Contributor branches are deleted automatically after merge.
- Approvals are dismissed when new commits are pushed to a PR — a fresh review is required after any changes.

### Guidelines

- This is a local-only tool — changes that introduce server-side hosting, auth systems, or deployment config are out of scope
- The UI targets internal users comfortable with telemetry data; no need to over-simplify the interface
- Stick to the existing stack (React 18 / Vite / Express / TypeScript) — dependency additions need a good reason

### Reporting Issues

Open a GitHub issue using the bug report template. Including the browser console output and any errors from the Express server (`npm run dev` stderr) is especially helpful.

## License

[MIT](LICENSE)

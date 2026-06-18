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

**2. Configure environment**

Copy `.env.example` to `.env.local` and fill in the connection string:

```bash
cp .env.example .env.local
```

| Variable | Description |
|---|---|
| `TELEMETRY_CONNECTION_STRING` | Azure portal → App Insights resource → Properties → Connection String |
| `LOG_PATH` | Optional. Folder where the server writes daily log files (default: `./logs`). |
| `LOG_LEVEL` | Optional. Minimum log level (`debug` \| `info` \| `warn` \| `error`). Default: `info`. |

**3. Run the app**

```bash
npm run dev
```

Opens the app at **http://localhost:7725**. The Express API proxy starts on port 7726.

## Settings

Click the **⚙ Settings** button in the top-right corner to manage all configuration from within the app.

### Security

**Azure login** — Sign in to Azure using the device code flow without leaving the app. Click **Login with Azure**, open the URL shown, enter the code, and the app detects sign-in automatically. Once authenticated, use **Switch Account** to change identities or **Refresh** to re-check status.

**Connection String** — Paste or update your App Insights connection string. Use **Test Connection** to verify the current Azure identity has access to the resource before saving. Changes take effect immediately — no server restart needed.

### Logging

**Log Level** — Controls the minimum severity written to disk (`debug`, `info`, `warn`, `error`).

**Log Path** — Click **Browse…** to select a local folder using the native folder picker. The server creates the folder if it doesn't exist and writes daily rotated log files (`app-YYYY-MM-DD.log`) inside it. Requires server restart to take effect.

### Theme

Switch between **Midnight** (dark) and **Sand Beach** (light). The preference persists across sessions.

## Status footer

A slim status bar at the bottom of the app shows the current Azure sign-in state (green/red dot), account name, subscription, tenant, and the active App Insights resource. It updates immediately when you sign in or out via Settings.

## Local logging

The server writes structured JSON logs to a daily rotated file alongside printing to the console. Configure via `.env.local` or the Settings panel:

- `LOG_PATH` — folder where log files are written (default: `./logs`). Today's file is `{LOG_PATH}/app-YYYY-MM-DD.log`.
- `LOG_LEVEL` — minimum level to persist (`debug`, `info`, `warn`, `error`). Default: `info`.

Retention/pruning of old log files is not implemented; add a pruning policy if you need to limit disk usage.

Example log entry (one JSON object per line):

```json
{"timestamp":"2026-06-15T23:00:00.123Z","level":"error","message":"Failed to query App Insights","meta":{"stack":"Error: ...","conversationId":"abc123","phone":"***"}}
```

> Client-side console output is forwarded to the server in development and persisted alongside server logs. Sensitive fields (tokens, phone numbers) are masked automatically.

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

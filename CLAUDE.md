# Agent Conversation Explorer

Internal React + TypeScript app for browsing and debugging live agent conversations via Azure Application Insights telemetry. Runs locally only — not deployed.

## Stack

- **Frontend:** React 18 / Vite 5 (port 3000)
- **Backend:** Express 4 proxy to App Insights REST API (port 3001)

## Common Commands

```bash
npm install        # first time only
npm run dev        # starts Vite (:3000) + Express (:3001) concurrently
npm run build      # TypeScript compile (both tsconfigs) + Vite build
```

## Configuration

Copy `.env.example` to `.env.local` and fill in at minimum `TELEMETRY_CONNECTION_STRING`. All values can also be managed via the in-app Settings panel.

```
TELEMETRY_CONNECTION_STRING="..."   # App Insights connection string (Azure portal)
LOG_PATH="./logs"                   # Folder for daily rotated log files (default: ./logs)
LOG_LEVEL="info"                    # debug | info | warn | error (default: info)
```

## Directory Structure

```
├── server/
│   ├── server.ts       # Express backend — proxies KQL queries to App Insights REST API
│   └── logger.ts       # Structured JSON file logger with daily rotation and field masking
├── vite.config.ts      # Vite config; root=app, /api/ proxied to Express (:7726)
├── tsconfig.json       # Frontend (app/) + vite.config.ts
├── tsconfig.server.json# Backend (server/) — NodeNext module resolution
├── app/
│   ├── index.html          # Vite entry HTML
│   ├── main.tsx            # React entry point; patches console to forward logs to server
│   ├── api.ts              # Fetch helpers for all server endpoints
│   ├── types.ts            # TypeScript interfaces shared across frontend
│   ├── App.tsx             # Root layout; owns theme, settings-open, auth, and list-refresh state
│   └── components/
│       ├── AppFooter.tsx           # Sticky footer: auth dot, account, subscription, tenant, App Insights ID
│       ├── ConversationList.tsx    # Sidebar: search, filters, time range selector
│       ├── ConversationFilters.tsx # Filter bar with active-chip display
│       ├── FilterPopover.tsx       # Popover: channel, agent, phone, outcome filters
│       ├── AgentFilter.tsx         # Multi-select agent filter
│       ├── SettingsMenu.tsx        # Full settings panel: theme, Azure auth, connection string, logging
│       ├── ConversationDetail.tsx  # Three-tab detail view (Chat / Execution Path / Errors)
│       ├── ChatView.tsx            # Message bubble rendering (user/bot, text/voice channels)
│       ├── ExecutionPath.tsx       # Topic flow visualizer with collapsible action details
│       └── ErrorPanel.tsx          # Error log with full customDimensions JSON
```

## Data Flow

`server.ts` obtains an Azure bearer token via `az account get-access-token` (cached until near-expiry), then POSTs KQL to the App Insights query REST API. Azure login can be triggered from within the app via the Settings panel (device code flow); no terminal `az login` required.

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/query` | Accepts raw KQL; used by `fetchConversations` |
| `POST` | `/api/conversation-events` | Accepts `{ conversationId }`, runs fixed KQL server-side (ID sanitized before embedding) |
| `GET`  | `/api/auth-status` | Returns current Azure CLI identity (`loggedIn`, `name`, `subscription`, `tenantId`, `tenantDisplayName`) |
| `POST` | `/api/auth-login` | Starts `az login --use-device-code`; returns `{ deviceCodeUrl, userCode }` or `{ loggedIn: true }` |
| `POST` | `/api/auth-logout` | Runs `az logout`; clears cached token |
| `GET`  | `/api/settings` | Returns current `.env.local` values for the settings allowlist |
| `POST` | `/api/settings` | Writes updated values back to `.env.local`; hot-reloads `TELEMETRY_CONNECTION_STRING` in memory (no restart needed); creates `LOG_PATH` directory if set |
| `POST` | `/api/test-connection` | Validates a connection string against the current Azure identity |
| `GET`  | `/api/app-status` | Returns parsed `appId` and `region` from the active connection string |
| `GET`  | `/api/browse-folder` | Opens native folder picker (PowerShell on Windows, osascript on macOS); returns selected path |
| `POST` | `/api/local-log` | Dev-only: persists client-side log entries to the server logger |

> **Note:** The Vite proxy key is `/api/` (trailing slash). This is intentional — it prevents the proxy from intercepting `app/api.ts` when Vite serves it as a module at `/api.ts`.

## Settings Panel

The `⚙ Settings` button opens a centered panel (70vw) managed by `SettingsMenu.tsx`. State is lifted to `App.tsx`:

- `settingsOpen` / `onOpenChange` — controls panel visibility
- `onAuthChange` — called after login/logout/switch-account; triggers an immediate footer refresh and resets the 120 s poll timer
- `onConnectionChange` — called after a successful connection string save; increments `listRefreshSignal` which re-triggers `fetchConversations`

### Section: Security
- Azure login via device code — `POST /api/auth-login` spawns `az login --use-device-code`; the UI polls `GET /api/auth-status` every 10 s (timeout 5 min) until login is confirmed
- Switch Account — logout then immediate re-login in one action
- Connection String — test before saving; save takes effect immediately server-side (hot-reload)

### Section: Logging
- Log Level — `select` written to `.env.local`; picked up on next server start
- Log Path — native folder picker via `GET /api/browse-folder`; `LOG_PATH` is a **directory**; the logger generates `app-YYYY-MM-DD.log` inside it

## Logging

`server/logger.ts` writes structured JSON (one object per line) to a daily rotated file and the console. Key behaviors:

- `LOG_PATH` is a directory (default `./logs`). The active file is `{LOG_PATH}/app-{YYYY-MM-DD}.log`.
- `LOG_LEVEL` is read dynamically on each write, so it changes without restart.
- `LOG_PATH` is read dynamically on each write; the server sets `process.env.LOG_PATH` from `.env.local` at startup so the value is always current.
- Sensitive fields (`token`, `accessToken`, `phone`, `phoneNumber`, etc.) are masked to `***` before writing.
- In development, `main.tsx` patches `console.*` to forward all browser log calls to `POST /api/local-log`, which persists them via the same logger. Vite HMR internal messages (`[vite]`, `[hmr]`) are filtered out before forwarding.

## KQL Queries (`api.ts`)

- `fetchConversations(timeRange)` — aggregates events per conversation: message counts, error counts, topics list, channel, caller phone. Returns top 500 sorted by recency.
- `fetchConversationEvents(conversationId)` — fetches all raw telemetry events for a single conversation, ordered by timestamp.

## UI

**Theming:** Two themes (Midnight, Sand Beach) selectable via Settings. Choice persists in `localStorage`; applied via `data-theme` attribute on `<html>`.

**AppFooter:** 24 px sticky bar at the bottom. Auth state (green/red dot, account name, subscription, tenant) is owned by `App.tsx` and polled every 120 s; it refreshes immediately on any auth event from Settings.

**ConversationList filters:** conversation ID / topic name search, phone number, channel (Omnichannel / IVR), agent (multi-select), time range (15m → 30d), outcome filter (all / completed / transferred / escalated / errored / abandoned). Accepts an external `refreshSignal` prop from `App.tsx` to re-fetch when the connection string changes.

**ConversationDetail tabs:**
- **Header** — shows conversation ID, channel, start time, message count, and a color-coded outcome indicator (completed / transferred / escalated / errored / abandoned).
- **Chat** — user/bot message bubbles; text (T) and voice (S) channels shown separately; AI-generated responses are badged.
- **Execution Path** — groups events by `TopicStart`/`TopicEnd`; shows nested actions with Kind and ActionId; expandable context rows and raw JSON per action; detects interrupted topics.
- **Errors** — lists all `OnErrorLog` events with full `customDimensions` JSON; links to the relevant step in Execution Path.

## Git & PR Conventions

Always include Claude as a co-author on every commit and PR:

```
Co-Authored-By: Claude <81847+claude@users.noreply.github.com>
```

This maps to [github.com/claude](https://github.com/claude) and makes Claude appear as a participant in GitHub PRs.

## UI Design Guidelines

**Always reuse existing patterns before creating new ones.** Before adding a new component or CSS class, search the codebase for an existing implementation. Key reusable patterns:

- **Info tooltip** — use `.info-tooltip-wrap` / `.info-tooltip-btn` / `.info-tooltip-body` (defined in `index.css`, used in `ConversationDetail.tsx`). Opens downward, right-anchored, themed. Do not invent a new tooltip mechanism.
- **Theme colours** — use CSS variables (`--accent`, `--success`, `--error`, `--text-muted`, etc.) defined in the `:root` / `[data-theme]` blocks at the top of `index.css`. Do not hardcode colours.
- **Status dots** — `.activity-dot` (orange) and `.dep-dot` (green) for inline indicators.

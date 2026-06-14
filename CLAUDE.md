# Agent Conversation Explorer

Internal React + TypeScript app for browsing and debugging live agent conversations via Azure Application Insights telemetry. Runs locally only — not deployed.

## Stack

- **Frontend:** React 18 / Vite 5 (port 7725)
- **Backend:** Express 4 proxy to App Insights REST API (port 7726)

## Common Commands

```bash
npm install        # first time only
npm run dev        # starts Vite (:7725) + Express (:7726) concurrently
npm run build      # TypeScript compile (both tsconfigs) + Vite build
```

**Auth prerequisite:** Run `az login` before starting the dev server — `server.ts` calls `az account get-access-token` to obtain a bearer token (cached until expiry).

## Configuration

Copy `.env.example` to `.env.local` and fill in the value:

```
TELEMETRY_CONNECTION_STRING="..."   # App Insights connection string (Azure portal)
```

## Directory Structure

```
├── server/server.ts        # Express backend — proxies KQL queries to App Insights REST API
├── vite.config.ts          # Vite config; root=app, /api/ proxied to Express (:7726)
├── tsconfig.json           # Frontend (app/) + vite.config.ts
├── tsconfig.server.json    # Backend (server/) — NodeNext module resolution
├── app/
│   ├── index.html          # Vite entry HTML
│   ├── main.tsx            # React entry point
│   ├── api.ts              # Fetch helpers (fetchConversations, fetchConversationEvents)
│   ├── types.ts            # TypeScript interfaces (ConversationSummary, ConversationEvent, etc.)
│   ├── App.tsx             # Two-panel layout: sidebar + detail; theme state + persistence
│   └── components/
│       ├── ConversationList.tsx    # Sidebar: search, filters, time range selector
│       ├── ConversationFilters.tsx # Filter bar with active-chip display
│       ├── FilterPopover.tsx       # Popover: channel, agent, phone, errors-only filters
│       ├── AgentFilter.tsx         # Multi-select agent filter
│       ├── SettingsMenu.tsx        # Settings button + theme picker (midnight / ivory)
│       ├── ConversationDetail.tsx  # Three-tab detail view (Chat / Execution Path / Errors)
│       ├── ChatView.tsx            # Message bubble rendering (user/bot, text/voice channels)
│       ├── ExecutionPath.tsx       # Topic flow visualizer with collapsible action details
│       └── ErrorPanel.tsx          # Error log with full customDimensions JSON
```

## Data Flow

`server.ts` obtains an Azure bearer token via `az account get-access-token` (cached until expiry), then POSTs KQL to the App Insights query REST API.

The React frontend uses two server endpoints:

- `POST /api/query` — accepts a raw KQL string; used by `fetchConversations`
- `POST /api/conversation-events` — accepts `{ conversationId }` and runs a fixed KQL query server-side; used by `fetchConversationEvents` (conversationId is sanitized on the server before embedding in KQL)

> **Note:** The Vite proxy key is `/api/` (trailing slash). This is intentional — it prevents the proxy from intercepting `app/api.ts` when Vite serves it as a module at `/api.ts`.

## KQL Queries (`api.ts`)

- `fetchConversations(timeRange)` — aggregates events per conversation: message counts, error counts, topics list, channel, caller phone. Returns top 500 sorted by recency.
- `fetchConversationEvents(conversationId)` — fetches all raw telemetry events for a single conversation, ordered by timestamp.

## UI

**Theming:** Two themes (Midnight, Ivory & Khaki) selectable via the Settings menu in the header. Choice persists in `localStorage`; applied via `data-theme` attribute on `<html>`.

**ConversationList filters:** conversation ID / topic name search, phone number, channel (Omnichannel / IVR), agent (multi-select), time range (15m → 30d), errors-only toggle.

**ConversationDetail tabs:**
- **Chat** — user/bot message bubbles; text (T) and voice (S) channels shown separately; AI-generated responses are badged.
- **Execution Path** — groups events by `TopicStart`/`TopicEnd`; shows nested actions with Kind and ActionId; expandable context rows and raw JSON per action; detects interrupted topics.
- **Errors** — lists all `OnErrorLog` events with full `customDimensions` JSON; links to the relevant step in Execution Path.


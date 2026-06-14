# Copilot instructions for Agent Conversation Explorer

Purpose: quick, repo-specific guidance to help future Copilot sessions understand how to build, run, and reason about this project.

---

## Quick commands

- Install deps: `npm install`
- Dev (frontend + proxy backend): `npm run dev` (Vite on http://localhost:7725, Express proxy on :7726)
- Build (TS compile + Vite build): `npm run build` (runs `tsc -p tsconfig.json && tsc -p tsconfig.server.json && vite build`)
- Preview Vite build: `npm run preview`

Notes: there is no linter script in package.json. Type-checking is performed by `tsc` (part of `npm run build`).

---

## High-level architecture

- Frontend: React 18 + Vite (app/). Single-page two-panel UI: sidebar (conversation list + filters) and detail (Chat, Execution Path, Errors).
- Backend: Express (server/server.ts) running on port 7726 as a proxy to the Application Insights Query REST API.
- Auth flow: the server shells out to the Azure CLI (`az account get-access-token`) to obtain a bearer token for App Insights queries; token is cached in memory until near expiry.
- Client↔Server contract:
  - POST /api/query — accepts a raw KQL string and returns App Insights query results (used by `fetchConversations`)
  - POST /api/conversation-events — accepts `{ conversationId }`; server runs a fixed KQL and returns ordered customEvents for the conversation (used by `fetchConversationEvents`)
- Data model: telemetry relies on `customEvents` and `customDimensions`. Important telemetry keys: `conversationId`, `TopicName`, `callerPhone`/`PhoneNumber`, `channelId`. Queries in `app/api.ts` assume those names and specific event names (`BotMessageReceived`, `BotMessageSend`, `OnErrorLog`, `TopicStart`).
- Dev proxy detail: Vite proxy key is `/api/` (trailing slash). This avoids colliding with the module path `app/api.ts` when Vite serves modules.

---

## Key conventions and repository-specific patterns

- Configuration: copy `.env.example` → `.env.local`. The server reads `.env.local` at startup (not via process.env) and parses `TELEMETRY_CONNECTION_STRING` to extract `ApplicationId`. After changing `.env.local` the server must be restarted to pick up the new values. Note: `.env.example` only includes `TELEMETRY_CONNECTION_STRING`.
- Token acquisition: server runs `az account get-access-token --resource "https://api.applicationinsights.io/"` and expects `az` to be logged-in and available on PATH.
- KQL usage: `fetchConversations(timeRange)` in `app/api.ts` returns top 500 recent conversations and uses `make_set_if` to collect topics (limit 20). Keep changes to that KQL consistent with the UI expectations.
- Conversation events endpoint sanitizes the incoming ID: server removes `"` before embedding in the KQL. Avoid passing untrusted multi-line input to these endpoints.
- UI theming: theme preference stored in `localStorage` and applied via `data-theme` on `<html>`.
- No CI config: repository doesn't include a linter or CI; CI, linting, or test runners should be added explicitly if needed.

---

## Useful files to inspect when debugging

- `server/server.ts` — App Insights proxy and auth logic (reads `.env.local`).
- `app/api.ts` — KQL queries & client-side parsing helpers.
- `app/types.ts` — core TS interfaces used by UI.
- `app/components/*` — UI: ConversationList, ConversationDetail, ExecutionPath, ErrorPanel, ChatView.
- `CLAUDE.md` / `README.md` — higher-level developer notes; CLAUDE.md contains a compact summary useful to Copilot sessions.

---

## How Copilot should reason about changes

- Preserve KQL semantics: UI expects columns and shapes produced by `fetchConversations`/`fetchConversationEvents`. If modifying KQL, update parsing in `app/api.ts` and components that consume results.
- Keep server behavior stable: token caching and the `ApplicationId` parsing are fragile. If altering `.env` handling, ensure `server.ts` still extracts `ApplicationId` and errors clearly when misconfigured.
- For UI changes, prefer editing files under `app/components/` and keep visual state (theme, filters) persisted where current code does.

---

## References & other assistant configs

- See `README.md` and `CLAUDE.md` for overlapping documentation; CLAUDE.md contains a concise summary of stack and commands.

---

If this file should be extended to cover CI, linting, or test-runner integration steps, say so and provide the preferred tools.

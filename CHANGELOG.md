# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2026-07-18

First public release of Agent Conversation Explorer — a local dev tool for browsing and
debugging live agent conversations via Azure Application Insights telemetry.

### Added

- **Conversation list** — sidebar of recent conversations with free-text search (conversation
  ID and topic names), phone-number filter, channel filter (Omnichannel / IVR), multi-select
  agent filter, time-range selector (15 minutes → 30 days), and an outcome filter. Each row
  shows message count, caller phone, and a color-coded outcome badge (completed / transferred /
  escalated / errored / abandoned).
- **Conversation detail — Chat tab** — renders the conversation as user/bot message bubbles,
  showing text (T) and voice (S) channels separately and badging AI-generated responses.
- **Conversation detail — Execution Path tab** — topic flow as a collapsible tree grouped by
  `TopicStart`/`TopicEnd`, with per-action Kind, ActionId, timestamps, context fields, and raw
  JSON. Outbound dependency calls (connectors, HTTP requests, Power Automate flows) are surfaced
  inline, and interrupted topics are classified (overridden / empty / incomplete / tool).
- **Conversation detail — Errors tab** — lists all `OnErrorLog` events with their full
  `customDimensions` payload, each linking back to the relevant Execution Path step.
- **Express backend proxy** — proxies KQL queries to the App Insights REST API, obtaining Azure
  bearer tokens via the Azure CLI (cached until near-expiry).
- **In-app Settings panel** — Azure sign-in via device code flow, connection-string management
  with test-before-save and hot-reload (no restart), log level, and native folder picker for the
  log path.
- **Structured logging** — daily rotated JSON log files with dynamic log level, plus forwarding
  of browser console output in development. Sensitive fields (tokens, phone numbers) are masked.
- **Status footer** — Azure sign-in state (account, subscription, tenant) and the active App
  Insights resource, polled and refreshed on auth events.
- **Theming** — Midnight (dark) and Sand Beach (light) themes, persisted in `localStorage`.

[Unreleased]: https://github.com/nipaul/Agent-Conversation-Explorer/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/nipaul/Agent-Conversation-Explorer/releases/tag/v1.0.0

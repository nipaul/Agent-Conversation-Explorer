# Repository Guidelines

See `CLAUDE.md` for deeper agent-specific instructions and repo context.

## Project Structure & Module Organization
This repo is a local React + TypeScript tool with a small Express backend.

- `app/` contains the Vite frontend: `main.tsx`, `App.tsx`, shared types, API helpers, and UI components in `app/components/`.
- `server/` contains the Express proxy and logging code.
- `logs/` is created at runtime for daily rotated JSON logs.
- `vite.config.ts`, `tsconfig.json`, and `tsconfig.server.json` define the frontend and server build boundaries.

## Build, Test, and Development Commands
Use the existing npm scripts:

```bash
npm install
npm run dev
npm run build
npm run preview
```

- `npm run dev` starts Vite on `http://localhost:3000` and the Express API on `:3001`.
- `npm run build` runs TypeScript compilation for both targets and then builds the frontend.
- `npm run preview` serves the production Vite build locally.

## Coding Style & Naming Conventions
Follow the existing codebase style:

- TypeScript + React with ES modules.
- Use 2-space indentation and keep formatting consistent with nearby files.
- Name React components in `PascalCase` (`ConversationList.tsx`), helpers in `camelCase`, and config files in lowercase.
- Keep backend/server code in `server/` and UI code in `app/`; avoid cross-cutting changes unless required.

No formatter or linter is configured in `package.json`, so keep edits minimal and match surrounding style.

## Testing Guidelines
There is no dedicated automated test suite in this repository yet. The required validation is:

- `npm run build` for type-checking and production bundling.
- Manual smoke testing in `npm run dev` against a real Application Insights connection string.

If you add tests, prefer colocated names such as `ComponentName.test.tsx` and document the new command in `package.json`.

## Commit & Pull Request Guidelines
Recent history uses short, imperative commits with issue or PR context, for example: `Add local logging feature with documentation (#3)`.

For pull requests:

- Keep the scope focused on one change.
- Describe the behavior change and any config impact.
- Include screenshots for UI changes.
- Confirm `npm run build` passes before requesting review.

## Configuration & Security Notes
Copy `.env.example` to `.env.local` and set `TELEMETRY_CONNECTION_STRING` before running the app. Do not commit secrets, Azure tokens, or local log output.

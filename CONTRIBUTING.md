Contributing to Agent Conversation Explorer

Thank you for your interest in contributing! This document explains how to report issues, propose changes, and run the project locally so PRs are easy to review.

Code of Conduct

Be respectful. This project follows a code of conduct. Treat others with courtesy and professionalism in issues, PR comments, and discussions.

Reporting Issues

- Search existing issues before opening a new one.
- Provide a clear title and steps to reproduce, expected vs actual behavior, and environment details (OS, Node version).
- For UI bugs, include screenshots or short screen recordings when helpful.

Proposing Changes (Pull Requests)

1. Fork the repository and create a topic branch named like: feature/short-description or fix/short-description.
2. Keep changes small and focused; one change per PR.
3. Update or add documentation when behavior or APIs change.
4. Run the build and type-check before opening a PR:
   - npm install
   - npm run build
5. Commit messages
   - Use short, imperative subject lines (e.g., "Add settings panel to AppFooter").
   - Include a brief description in the commit body when needed.
   - If the PR should include a Co-authored-by trailer, add it to the commit message.
6. Open the PR against the repository main branch and include:
   - A concise description of the change and rationale
   - Any steps to verify the change
   - Screenshots for UI changes

Development Setup

- Install dependencies:
  npm install

- Dev server (frontend + proxy backend):
  npm run dev

  Vite serves the frontend at http://localhost:7725 and the Express proxy at http://localhost:7726 by default.

- Build and type-check:
  npm run build

- Preview production build:
  npm run preview

Notes and Conventions

- TypeScript is used across the frontend and server.
- Use 2-space indentation and follow existing file style.
- Keep server code in server/ and UI code in app/.
- Configuration: copy .env.example to .env.local and set TELEMETRY_CONNECTION_STRING before running the dev server. Do not commit secrets.

PR Checklist

- [ ] Code builds and type-checks (npm run build)
- [ ] Changes are small and focused
- [ ] Documentation (README, CLAUDE.md, or this file) updated if relevant
- [ ] Screenshots provided for UI work
- [ ] No secrets committed

How to Contribute to Discussions

- Be constructive and patient. If you disagree, explain why and propose alternatives.

Thanks for helping make Agent Conversation Explorer better!

If you'd like help getting started, open an issue with "help wanted" and a short description of what you'd like to do.
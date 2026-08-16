# Jira Leaderboard

Jira Leaderboard is a simple, stateless web dashboard for comparing sprint results in Jira. It works in any modern browser—no installation required.

**Features:**
- Picks the current sprint and suggests the previous one
- Lets you pick from recent sprints and see sprint history
- Tracks work by developer, using the Jira `Developer` field
- Shows separate all-time developer and QA leaderboards for completed work
- Shows ticket stats: Done, QA, Ready for QA, story points, bounces, ticket totals
- Compares sprint progress by developer
- Optionally compares across QA/development boards, tracking the `Tester` field
- Can filter by date range, developer, project, or advanced JQL

## Privacy and Security

- No database: the server never stores users, Jira data, or reports.
- Preferences (board/QA board/status/etc.) save in your browser's localStorage, **not** Jira credentials.
- Jira site, email, and API token are encrypted using AES-256 into a secure cookie (unreadable by JavaScript).
- SESSION_ENCRYPTION_KEY stays server-side. Changing it logs everyone out.
- Allowed Jira hosts default to `*.atlassian.net`, but you can override with `JIRA_ALLOWED_HOSTS`.
- All APIs are read-only; the server cannot change data in Jira.
- Only safe, secure API operations are exposed.

## Quick Start (Local with Bun)

Requires [Bun](https://bun.sh/) 1.3.9+.

```sh
cp .env.example .env
openssl rand -base64 32
```
Paste that value into `SESSION_ENCRYPTION_KEY` in `.env`, then:

```sh
bun install --frozen-lockfile
bun run dev
```

Go to `http://localhost:5173` to start. Follow the onboarding instructions and connect your Jira account. QA board setup is optional. Credentials are saved in a cookie for up to one year, unless cleared or the server key changes.

Supports classic and scoped Atlassian API tokens; Cloud IDs are auto-detected—no manual input needed. For required scopes or API token help, see Atlassian's [API token docs](https://support.atlassian.com/atlassian-account/docs/manage-api-tokens-for-your-atlassian-account/).

## Checks

```sh
bun run check
bun run build
```

Runs formatting/linting (via Biome), Svelte/TypeScript checks, and tests.

For live Jira API tests (read-only, no mocks):

```sh
JIRA_LIVE_TESTS=1 \
JIRA_URL=https://company.atlassian.net \
JIRA_EMAIL=you@company.com \
JIRA_API_TOKEN=your-token \
JIRA_BOARD_ID=123 \
JIRA_PROJECT_KEY=DEMO \
bun test ./Tests/live-jira.test.ts
```

## Technology

- Bun (package manager, runtime, tests)
- SvelteKit 2 (with Svelte 5)
- Tailwind CSS 4 (compiled, no runtime)
- Biome 2 (format/lint)
- Runs with SvelteKit Node adapter (on Bun)

## Structure

```
src/lib/domain/     Sprint and project logic
src/lib/server/     Encryption, validation, Jira API calls
src/lib/browser/    Local settings and browser APIs
src/lib/components/ UI components
src/routes/api/     API routes
Tests/              All tests (unit/security/live)
```

The old SwiftUI version is still available at commit `0fe9901`.

## License

[MIT](LICENSE)

# Jira Leaderboard

Jira Leaderboard is a simple, stateless web dashboard for comparing sprint results in Jira. It works in any modern browser—no installation required.

**Features:**
- Picks the current sprint and suggests the previous one
- Lets you pick from recent sprints and see sprint history
- Tracks work by developer, using the Jira `Developer` field
- Shows yearly developer and QA leaderboards, with an optional all-time view
- Shows ticket stats: Done, QA, Ready for QA, story points, bounces, ticket totals
- Compares sprint progress by developer
- Optionally compares across QA/development boards, tracking the `Tester` field
- Can filter by date range, developer, project, or advanced JQL

## Privacy and Security

- No database: the server never stores users, Jira data, or reports.
- Preferences (board/QA board/status/etc.) save in your browser's localStorage.
- Jira site, email, and API token are encrypted using AES-256 into a secure cookie.
- All APIs are read-only; the server cannot change data in Jira.

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
bun test ./tests/live-jira.test.ts
```

## Technology

- Bun (package manager, runtime, tests)
- SvelteKit 2 (with Svelte 5)
- Tailwind CSS 4
- Biome 2 (format/lint)

## License

[MIT](LICENSE)

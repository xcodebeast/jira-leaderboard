# Jira Leaderboard

Jira Leaderboard is a simple, stateless web dashboard for comparing sprint results in Jira. It works in any modern browser—no installation required.

**Features:**
- Picks the current sprint and suggests the previous one
- Lets you pick from recent sprints and see sprint history
- Combines Development and QA in one shared Sprint Performance view
- Tracks work by developer and tester without mixing their separate score models
- Shows board or global developer and QA leaderboards by year or all time
- Caches leaderboard scores in your browser for two hours; Refresh scores clears the cache and loads the latest results from Jira
- Opens individual developer and QA profiles with graph-controlled date ranges; zoomable daily/weekly/monthly timelines with an all-time reset; delivery pace, rework, and searchable ticket drill-down
- Shows ticket stats: Done, QA, Ready for QA, story points, bounces, ticket totals
- Compares sprint progress by developer
- Optionally adds a QA board scoped to the same development sprint, tracking the `Tester` field
- Can filter by date range, developer, project, or advanced JQL
- Creates frozen, read-only report links that recipients can open without signing in

## Privacy and Security

- No database: the server never stores users, Jira data, or reports.
- Preferences (board/QA board/status/etc.) save in your browser's localStorage.
- Calculated leaderboard scores also save in localStorage for two hours, separated by Jira account and report settings. Raw Jira issues and credentials are not cached. Reconnecting, disconnecting, or erasing local data clears the score cache.
- Jira site, email, and API token are encrypted using AES-256 into a secure cookie.
- All APIs are read-only; the server cannot change data in Jira.
- Shared snapshots are compressed and encrypted entirely in the browser, then stored in the URL fragment. The server never receives or stores the report or its decryption key.
- Anyone with a complete snapshot link can read and forward its frozen report. Snapshot links cannot be revoked or updated, and large reports may exceed portable URL limits.

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

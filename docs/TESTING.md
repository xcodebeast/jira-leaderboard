# Testing and acceptance checklist

## Automated checks

Run the complete local gate:

```sh
bun install --frozen-lockfile
bun run check
bun run build
```

The gate must prove:

- Biome formatting, recommended lint rules, and recommended assists pass.
- Every file is at most 1,000 lines and declared symbols have at least three characters.
- Svelte and TypeScript report zero errors and zero warnings.
- Sprint pagination, development and QA performance, configuration migration, setup suggestion, Jira normalization, URL allowlist, and credential encryption tests pass.
- The SvelteKit production server bundle builds successfully.

## Real Jira integration

The live suite talks to Jira directly. It does not use mocks, stubs, fixtures, or a database.

```sh
JIRA_LIVE_TESTS=1 \
JIRA_URL=https://company.atlassian.net \
JIRA_EMAIL=you@company.com \
JIRA_API_TOKEN=your-token \
JIRA_BOARD_ID=123 \
JIRA_PROJECT_KEY=DEMO \
bun test ./Tests/live-jira.test.ts
```

It discovers Scrum boards, associated projects, and custom fields; reads board configuration and statuses; lists active and closed sprints; reads one sprint's issues; and performs a resolved-issue JQL search. All operations are read-only.

## Browser acceptance workflow

Use a clean browser profile and a Jira token with the same permissions as the intended scrum master.

1. Open the deployed URL on macOS and Windows.
2. Confirm the page is responsive at desktop and narrow mobile widths.
3. Select Create token and confirm the modal offers both classic and scoped instructions before linking to Atlassian.
4. Enter an invalid Jira URL and confirm onboarding shows a useful error.
5. Enter an invalid API token and confirm onboarding remains visible without saving a session.
6. Connect valid credentials, replace them from Settings, and confirm the Jira site is prefilled on onboarding.
7. Confirm the first accessible Scrum board is selected. For a single-project board, confirm its period project is selected automatically; for a multi-project board, confirm no arbitrary project is selected.
8. Review Story Points, Developer, Bounce Count, Done, QA, and Ready for QA mappings. Confirm field options show names without Jira field identifiers.
9. Enable the optional QA leaderboard, choose a different Kanban board that does not expose sprints, and review Story Points, Tester, Done, and Ready for QA mappings.
10. Save setup, reload the browser, and confirm onboarding is skipped.
11. Confirm Development selects the active sprint, suggests the previous closed sprint, and shows totals, developer rows, ticket keys, and deltas.
12. Open each sprint selector, search the loaded sprints, load an older page, and confirm the selection remains responsive.
13. Confirm QA loads without a sprint-support error, uses the development sprint, excludes issues outside the QA board, and shows Done and Ready-for-QA points and ticket counts per Tester.
14. Compare the development sprint output with the original script for the same sprints.
15. Run Periods with the same dates, project/JQL, and developer filters as the original script and compare every total and row.
16. Disable the network and confirm a readable retryable error appears without losing browser preferences.
17. Replace Jira credentials in Settings and confirm the existing board setup remains.
18. Change the board mappings and confirm the new setup is used.
19. Erase local data and confirm the app returns to onboarding, the credential cookie is gone, and all preferences are removed from `localStorage`.

Browser or end-to-end tests must follow this real user workflow. They must not access a database directly or replace Jira with mocks or stubs.

# Railway deployment

## Required environment

Set one secret before the first deployment:

```text
SESSION_ENCRYPTION_KEY=<base64-encoded 32-byte random value>
```

Generate it outside Railway with:

```sh
openssl rand -base64 32
```

Do not commit the generated value. Do not reuse the Jira API token as the encryption key.

`JIRA_ALLOWED_HOSTS` is optional. Its default is `*.atlassian.net`. For a narrower deployment:

```text
JIRA_ALLOWED_HOSTS=company.atlassian.net
```

Multiple entries are comma-separated. Wildcards must use the `*.` prefix. Jira site URLs must use HTTPS and cannot contain credentials, paths, query strings, or fragments.

## Deploy

1. Create a new Railway project from the Git repository.
2. Let Railway build the root `Dockerfile`.
3. Add the required environment variables.
4. Generate a public domain or attach the intended custom domain.
5. Set the health check path to `/api/health`.
6. Do not add a database or persistent volume; the app does not use either.

The container runs as an unprivileged user and listens on Railway's `PORT` value.

## Secret rotation

Rotating `SESSION_ENCRYPTION_KEY` is safe but immediately invalidates all encrypted credential cookies. Every user will return to onboarding and must enter their Jira token again. Browser-local board and field preferences remain intact.

## Access control

Jira Leaderboard authenticates users to Jira but does not authenticate access to the website itself. If the deployment must be internal, enforce identity at Railway, a reverse proxy, or your company's access gateway. The application should not be treated as an Atlassian Marketplace OAuth app.

## Operational data

The app intentionally has no analytics, application database, or report cache. Railway may still retain platform request logs and infrastructure metadata according to the operator's Railway configuration. Avoid enabling middleware that records request bodies or cookie headers.

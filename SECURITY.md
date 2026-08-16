# Security policy

## Supported version

Security fixes are applied to the latest version on the default branch.

## Reporting a vulnerability

Please use a private GitHub security advisory for credential exposure, request forgery, authentication, or injection findings. Do not include a real Jira API token, session cookie, email address, or company Jira URL in a public issue.

## Credential model

- Jira credentials are encrypted with AES-256-GCM and stored in an HttpOnly, SameSite=Strict cookie.
- The encryption key exists only as the server-side `SESSION_ENCRYPTION_KEY` environment variable.
- The API token is never placed in `localStorage` or returned to browser JavaScript.
- The server has no application database and does not persist Jira responses.
- Jira hosts are restricted to `*.atlassian.net` unless an operator explicitly changes `JIRA_ALLOWED_HOSTS`.
- Jira operations are limited to account discovery, board metadata, sprint reads, and issue searches. There are no Jira mutation routes.

Rotating `SESSION_ENCRYPTION_KEY` invalidates every existing credential cookie. Users must reconnect Jira after a rotation.

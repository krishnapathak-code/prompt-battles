# Security Notes

- All external inputs must be validated server-side.
- Scoring endpoint (/api/score) must be rate-limited (e.g., 30 req/min per IP or per authenticated user).
- Run `npm audit` when updating dependencies and address high/critical advisories before merging.
- Secrets must never be committed to the repository. Use GitHub Secrets for keys and credentials.
- Use CodeQL for code scanning and review alerts in Security → Code scanning alerts.

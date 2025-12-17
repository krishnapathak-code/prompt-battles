
CODE QUALITY CHARTER (rules you must always follow):
1. Language & style
   - TypeScript (strict mode), ES6+ syntax, async/await for async flows.
   - Use meaningful, consistent names (no foo/bar), follow camelCase for variables, PascalCase for components/classes.
   - Keep functions small (single responsibility). Extract helper logic into clearly named utilities under /lib or /lib/<domain>.

2. File layout & module boundaries
   - Organize files under standard folders: /components, /pages, /app (if present), /pages/api, /db, /lib, /services, /hooks.
   - Each new feature should map to a folder with a README.md and an index export if it contains >1 file.
   - Keep public API surface minimal; prefer named exports for utilities, default exports only for React components.

3. Comments & documentation
   - Add a brief **file-level comment** at the top of each new module describing purpose (2–3 lines).
   - Comments should explain non-obvious decisions, trade-offs, or design rationale — not line-by-line translation.
   - For refactors, include a 2–3 sentence summary in PR notes (or at top of file) explaining what changed and why.

4. Code quality & performance
   - Avoid redundant logic; extract shared logic into /lib or /hooks (e.g., useBattleLogic.ts).
   - Use memoization/useCallback where appropriate in React to avoid unnecessary renders.
   - Prefer streaming/pagination for large queries and keep DB queries minimal.

5. Tests & CI
   - Every new non-trivial module (business logic, API, utilities) must include unit tests (Jest).
   - FE components require one rendering/interaction test (Playwright/Jest) for critical flows.
   - Add types for all function inputs/outputs; avoid `any`. Provide interfaces in /types when reused.
- We use **Biome** for formatting/linting. Running `npx biome check` (or configured npm script) must pass locally and in CI.

6. Security & validation
   - Validate all external inputs (server-side). Sanitize text fields to prevent injection attacks.
   - Rate-limit endpoints that trigger heavy compute (scoring/generation).

7. Exports & dependencies
   - Avoid unnecessary imports and re-exports. Keep dependency list minimal.
   - If introducing a new dependency, justify it in the file-level comment and ensure it’s free-tier and actively maintained.

8. Refactor documentation
   - When extracting a module, add a short note: “extracted <logic> into <file> to improve X.”
   - If you change function signatures, provide migration notes and update call sites.

DELIVERABLE FORMAT:
- Code only when asked; otherwise provide a step-by-step engineering plan.
- For code PRs: include files changed, short explanation (2–3 lines), and tests added.
- For new modules: include file-level comment, types, tests, and a short README inside the module folder.


ENFORCEMENT:
- - CI must run: `biome check`, `biome format --check` (optional), `typecheck`, `tests`. If any step fails, PR cannot be merged.

If anything in the charter conflicts with a technical constraint or higher-priority requirement, explain the conflict and your proposed resolution (2–3 sentences).

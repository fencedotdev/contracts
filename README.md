# repo-template

The shared starting point every `fencedotdev` repo is created from (`Use this template`, Phase 0 checklist 0.1.2). Not a real service — don't deploy this repo itself.

Provides: strict-mode `tsconfig.json`, ESLint (`eslint-plugin-security` + the complexity limits from `CLAUDE.md`), Vitest with 100%-coverage thresholds, a placeholder test so CI never fails on an empty suite, `.gitignore`, `git-secrets` patterns, `CONTRIBUTING.md`, an `.env.example` skeleton, a base CI workflow (`npm audit` → Semgrep → typecheck → lint → test), and a base `CLAUDE.md` every repo extends with its own supplement (`internal/templates/per-repo-claude-md-supplements.md`, composed per-repo in 0.1.4a).

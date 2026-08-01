# Contributing

## Required local setup

1. Install `gitleaks` (once per machine): `brew install gitleaks`
2. In this repo:
   ```
   mkdir -p .git/hooks
   printf '#!/usr/bin/env bash\ngitleaks protect --staged --redact -v\n' > .git/hooks/pre-commit
   chmod +x .git/hooks/pre-commit
   ```
   This installs a pre-commit hook that blocks known secret patterns (Stripe/AWS/GCP keys, private-key blocks, generic high-entropy API-key assignments -- gitleaks' own default ruleset, `.gitleaks.toml` extends it with a couple of Fence-specific patterns) before they leave your machine. Verify it actually works after setup: try committing a file containing a realistic-looking fake secret (mixed-case/digits, not a sequential string like `abc123` -- low-entropy test strings won't trigger entropy-based rules, which is correct behavior, not a bug) and confirm the commit is rejected.
   **Replaces `git-secrets`, retired 2026-08-01** -- it combined every registered pattern into one alternation regex that a BSD-`grep` incompatibility made crash on *every* commit, not just ones containing a real secret. gitleaks evaluates rules independently, so one bad rule can't take the whole scan down.
3. Sign your commits (`git config commit.gpgsign true`, or use `gh` / your editor's built-in signing) — branch protection on `main` requires signed commits and will reject unsigned ones at the PR merge stage regardless of local config.

## Workflow

- No direct pushes to `main` — every change goes through a PR.
- CI (`.github/workflows/ci.yml`) must pass: `npm audit`, Semgrep, type check, lint, and tests with 100% coverage.
- Write the failing test first (TDD, non-negotiable — see this repo's `CLAUDE.md`).
- Never use `--no-verify`, `--force`, or `--hard` on git commands — these bypass the hooks and checks that exist for a reason.

## No AI attribution

Never add `Co-Authored-By: Claude`, "Generated with Claude Code", or any AI-tool attribution to a commit message or PR description — see `CLAUDE.md`.

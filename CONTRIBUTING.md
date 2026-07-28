# Contributing

## Required local setup

1. Install `git-secrets` (once per machine): `brew install git-secrets`
2. In this repo:
   ```
   git secrets --install
   git secrets --register-aws
   while read -r p; do [ -n "$p" ] && [[ "$p" != \#* ]] && git secrets --add "$p"; done < .git-secrets-patterns
   ```
   This installs a pre-commit hook that blocks known secret patterns (AWS keys, Stripe keys, Supabase keys, private-key blocks, generic high-entropy API-key assignments) before they leave your machine.
3. Sign your commits (`git config commit.gpgsign true`, or use `gh` / your editor's built-in signing) — branch protection on `main` requires signed commits and will reject unsigned ones at the PR merge stage regardless of local config.

## Workflow

- No direct pushes to `main` — every change goes through a PR.
- CI (`.github/workflows/ci.yml`) must pass: `npm audit`, Semgrep, type check, lint, and tests with 100% coverage.
- Write the failing test first (TDD, non-negotiable — see this repo's `CLAUDE.md`).
- Never use `--no-verify`, `--force`, or `--hard` on git commands — these bypass the hooks and checks that exist for a reason.

## No AI attribution

Never add `Co-Authored-By: Claude`, "Generated with Claude Code", or any AI-tool attribution to a commit message or PR description — see `CLAUDE.md`.

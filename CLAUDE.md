<!--
This is the BASE CLAUDE.md inherited by every fencedotdev repo via `repo-template`
(Phase 0 checklist 0.1.2). When each of the 10 product repos is created, its real
CLAUDE.md = this file + that repo's section from `per-repo-claude-md-supplements.md`,
inserted where the "## <repo-name> specifics" marker below indicates (0.1.4a).
Delete this comment block when composing the real file — it's build-time guidance,
not part of any repo's actual CLAUDE.md.
-->

# Fence — <repo-name>

<!-- One-sentence bounded-context statement goes here, from the repo's README (0.1.4). -->

Full product brief: `../internal/briefs/260727_fence_id_v1.0.md`
Build order: `../internal/checklists/fence-build-order.md`
How we work (stack + process): `../internal/onboarding/fence-team-brief-how-we-work.md`

## Non-negotiable rules

**No `Co-Authored-By: Claude` or any AI attribution in commits or PRs.** Never add `Co-Authored-By:`, "Generated with Claude Code", or any AI tool attribution to a commit message or PR description.

**No payment fields.** Nothing in this repo — schema, API shape, or dependency on `contracts` — may introduce a payment-shaped field (amounts tied to settlement, card/wallet references, anything beyond the generic `limits`/`value` shapes already in M·2/M·3) unless the brief's Prong 2 is explicitly and separately scoped. See `fence-build-order.md`, Critical architecture notes.

---

## <repo-name> specifics

<!-- INSERT REPO SUPPLEMENT HERE (0.1.4a): stack subset, codebase structure, what
     this repo owns / explicitly does not own, domain vocabulary. Source:
     `internal/templates/per-repo-claude-md-supplements.md`. -->

---

## Type safety rules

```
No any
No type assertions (as SomeType) — fix the type instead
No non-null assertions (value!) — handle the nullable case
No @ts-ignore
No @ts-expect-error without a comment explaining why the type system is wrong
```

TypeScript strict mode is enabled. All compiler errors are resolved — not silenced.

## Testing (TDD — non-negotiable)

1. Write failing test → confirm RED
2. Write minimum code to pass → confirm GREEN
3. Refactor → commit

Writing implementation before the test is not acceptable. 100% test coverage is mandatory and enforced in CI — a thin service is not an excuse for thin tests; in a repo this small, most of what exists *is* the product.

## Complexity limits (ESLint-enforced)

- Max file length: 400 lines (excluding blanks and comments)
- Max function length: 60 lines
- Max cyclomatic complexity per function: 12
- Max indentation depth: 3

When you hit a limit, decompose — do not raise the limit.

Banned folder names: `utils/`, `helpers/`, `common/`, `shared/`, `core/` — everything gets a domain-specific home.

## Security

- `eslint-plugin-security` in CI — all issues resolved before merge
- `npm audit --audit-level=high` in CI — failing audit blocks merge
- **Socket.dev** GitHub App installed — scans every PR touching `package.json`/`package-lock.json` for malicious packages, hidden telemetry, supply-chain attacks, and new maintainers added to dependencies
- Branch protection on `main`: no direct pushes, PR required, CI must pass
- Signed commits required
- No credentials in source code — GitHub secret scanning + push protection enabled; a `git-secrets` pre-commit hook blocks known secret patterns before they leave your machine
- If this repo ever touches the issuer signing key or Sumsub credentials directly, stop — it almost certainly shouldn't. Signing happens only in `issuance`; KYB/KYC vendor calls happen only in `identity-kyb`. See `fence-team-brief-how-we-work.md` §8.

## Hooks

An automatic code review runs after every Claude Code session in this repo. It reviews modified files against `.claude/automatic-code-review/rules.md` and reports convention violations before you see the result — including the no-payment-fields rule above where this repo touches `contracts` or `verify()` shapes. Do not bypass the reviewer.

The `PreToolUse` hook blocks `--no-verify`, `--force`, and `--hard` on git commands.

## MCP-first for third-party integrations

Before hand-rolling a client for a vendor, check whether they publish an MCP server. Supabase is already connected in this workspace — use it for schema/migration/log work rather than raw `psql` or dashboard clicks. See `fence-team-brief-how-we-work.md` §7 for what's connected and what isn't (Sumsub has no known MCP server as of this writing — a thin typed client is the right call there).

# Fence — contracts

Owns the shared, versioned contracts every other repo imports — the passport, mandate, verify() request, and verify() decision shapes.

Full product brief: `../internal/briefs/260727_fence_id_v1.0.md`
Build order: `../internal/checklists/fence-build-order.md`
How we work (stack + process): `../internal/onboarding/fence-team-brief-how-we-work.md`

## Non-negotiable rules

**No `Co-Authored-By: Claude` or any AI attribution in commits or PRs.** Never add `Co-Authored-By:`, "Generated with Claude Code", or any AI tool attribution to a commit message or PR description.

**No payment fields.** Nothing in this repo — schema, API shape, or dependency on `contracts` — may introduce a payment-shaped field (amounts tied to settlement, card/wallet references, anything beyond the generic `limits`/`value` shapes already in M·2/M·3) unless the brief's Prong 2 is explicitly and separately scoped. See `fence-build-order.md`, Critical architecture notes.

---

## contracts specifics

**Type:** Library, no deploy — publishes a versioned package every other repo imports.

**Stack:** TypeScript, Zod (or equivalent) for runtime-validated schemas + inferred types. No framework, no database, no HTTP server.

**Owns:** the four M·1–M·4 shapes from the brief — the passport (SD-JWT-VC payload), the mandate, the `verify()` request, the `verify()` decision. This is the seam every other repo builds against (App. C).

**Does not own:** any business logic, any persistence, any HTTP handling — those all live in the consuming repos.

**Codebase structure:**
```
src/
  passport.ts          # M·1 — passport schema + types
  mandate.ts           # M·2 — mandate/scope schema + types
  verify-request.ts     # M·3
  verify-decision.ts    # M·4
  index.ts              # public exports
test/
  fixtures/              # one fixture instance per shape, used by consumer contract tests
  no-payment-fields.test.ts   # enforces the no-payment-fields rule (0.5.5)
  generic-limits.test.ts      # proves payment and API-quota limits share one shape (0.5.3)
```

**Architecture invariants:**
- No field anywhere in this package may be payment-shaped (no `funded`, no `payment` action type, no card/wallet reference) until Prong 2 is explicitly and separately scoped. This is enforced by `test/no-payment-fields.test.ts`, not just this instruction.
- `mandate.constraints.limits` is generic (`{ metric, unit, max }`) — a spend cap and an API quota are the same shape with different `metric` values. Never add a payment-specific limit type.
- The mandate is *referenced* from the passport (`mandateRef`), never embedded — see M·1's design note.
- `decision.outcome` (the honest verdict) and `decision.effective` (was it enforced) are separate fields — this is the enforcement-mode seam `grace` slots into later without a schema change.
- A version bump here must pass the consumer-driven contract test suite against every consuming repo before it publishes (see `fence-checklist-phase-0.md` 0.3.7, 0.5.6).

**Domain vocabulary:** passport, mandate, `verify()`, claims, assurance level, outcome/effective, reason codes, environment (`live`/`test`).

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
- If this repo ever touches the issuer signing key or IDV vendor credentials directly, stop — it almost certainly shouldn't. Signing happens only in `issuance`; KYB/KYC vendor calls happen only in `identity-kyb`. See `fence-team-brief-how-we-work.md` §8.

## Hooks

An automatic code review runs after every Claude Code session in this repo. It reviews modified files against `.claude/automatic-code-review/rules.md` and reports convention violations before you see the result — including the no-payment-fields rule above where this repo touches `contracts` or `verify()` shapes. Do not bypass the reviewer.

The `PreToolUse` hook blocks `--no-verify`, `--force`, and `--hard` on git commands.

## MCP-first for third-party integrations

Before hand-rolling a client for a vendor, check whether they publish an MCP server. Supabase is already connected in this workspace — use it for schema/migration/log work rather than raw `psql` or dashboard clicks. See `fence-team-brief-how-we-work.md` §7 for what's connected and what isn't (Sumsub has no known MCP server as of this writing — a thin typed client is the right call there).

# Automatic Code Review Rules

Review only files passed to you. Report violations with `file:line` references.
Use ❌ FAIL or ✅ PASS for each rule. Report ALL violations found.

**Rules 1–6 below are the shared Fence base** (from `repo-template`) — every
product repo starts from these unchanged. A repo may append its own
repo-specific rules after Rule 6 (see that repo's own `CLAUDE.md` "Owns" /
"Does not own" / architecture-invariants sections for what belongs there);
never remove or weaken a base rule when extending it.

---

## Rule 1: No type shortcuts

Flag any occurrence of:
- `any` type
- `as SomeType` type assertion
- `!` non-null assertion operator
- `@ts-ignore` or `@ts-expect-error` without an explanatory comment on the same line

These are always wrong. Fix the underlying type — do not silence it.

---

## Rule 2: No dangerous fallback values on required fields

Flag `?? defaultValue` or `|| defaultValue` where the left-hand side is a field
that must be explicitly provided — anything the schema marks `NOT NULL`,
especially identity, audit, and payment-status fields (e.g. `kyb_status`,
`gate2_payments.status`, `verify_decisions.*`, `company_users.status`,
`environment`).

Required values must throw or return a typed error. Silent defaults mask data
integrity bugs.

---

## Rule 3: No generic naming

Flag files, folders, or exported names containing:
- `util`, `utils`, `helper`, `helpers`
- `common`, `shared`, `core`
- `handler`, `handlers` (outside `app/api/` route files)
- `service`, `services` (as a generic noun — domain-specific names like `envelopeService` are fine)

Names must express a domain concept.

---

## Rule 4: No payment-shaped fields outside a repo explicitly scoped for them

Flag any new field, schema column, or dependency on `contracts` that introduces
a payment-shaped value — an amount tied to settlement, a card/wallet
reference, or anything beyond the generic `limits`/`value` shapes already in
`contracts`' M·2/M·3 schemas — unless the brief's Prong 2 is explicitly and
separately scoped for this repo. This is a non-negotiable rule from every
repo's own `CLAUDE.md`, not a style preference.

---

## Rule 5: Secret and credential handling

Flag any of the following:
- A raw API key, token, or credential stored in a database column — only a
  hash (and, where the product needs it for display, a short non-secret
  prefix) may be persisted. Matches the pattern already built for RP API
  keys: `crypto.randomBytes(32)` + SHA-256 hash, `api_key_hash`/`api_key_prefix`
  columns, the raw value returned exactly once.
- `console.log`/`logger.*` calls that include what appear to be secrets,
  tokens, passwords, or full credential values as raw arguments.
- A secret read from `.env`/environment and then printed, echoed, or included
  in a response body rather than consumed directly.

---

## Rule 6: No comments describing WHAT

Flag inline code comments (`//` or `/* */`) that describe WHAT the code does.

Acceptable (one line, must explain WHY):
- A non-obvious invariant
- A reference to a checklist item or spec section (e.g., `// checklist 1.3.5`)
- A workaround for a documented external bug

Not acceptable:
- Comments that restate what the code already says
- TODO comments
- Commented-out code

---

## Rule 7: Schema changes need a version bump

Flag any change to a published schema in `src/passport.ts`, `src/mandate.ts`,
`src/verify-request.ts`, or `src/verify-decision.ts` (the M·1–M·4 shapes) that
isn't accompanied by a version bump in `package.json`. Every other Fence repo
imports this package, so an unversioned schema change has fleet-wide blast
radius. This repo's own `CLAUDE.md` states a version bump here must pass the
consumer-driven contract test suite against every consuming repo before it
publishes — a schema edit with no version bump can't have gone through that
gate.

---

## Rule 8: `mandate.constraints.limits` stays generic

Flag any new limit type, or any field/schema addition, that special-cases a
particular `metric` (e.g. a payment-specific limit shape) instead of using the
existing generic `{ metric, unit, max }` shape in `mandate.ts`. `CLAUDE.md` is
explicit that a spend cap and an API quota are the same shape with different
`metric` values, and that a payment-specific limit type must never be added.

---

## Rule 9: Mandate is referenced from the passport, never embedded

Flag any change to `passport.ts` that embeds a full mandate object rather than
referencing it via `mandateRef`. `CLAUDE.md` documents this as a deliberate
design invariant (see M·1's design note) — embedding defeats the point of
keeping the mandate independently updatable/revocable.

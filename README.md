# packages

Public, versioned packages Fence publishes — an npm-workspaces monorepo, renamed from `contracts` 2026-08-21 when this became a home for more than one package.

## Packages

- **`packages/contracts`** (`@fence.dev/contracts`) — the shared, versioned schemas every other repo imports: the passport, mandate, `verify()` request, and `verify()` decision shapes (the M·1–M·4 seam, App. C).
- More to follow — `credential-verification` (did:web/signature verification logic a relying party might want to audit) is next.

**Why public:** these are the interoperability surface third parties build against. For genuinely internal-only shared code (used only by Fence's own services, never meant for a third party to see), see the separate, private `internal-packages` repo instead — see this repo's own `CLAUDE.md` for the full public/private split rationale.

## Reference

- Product brief: `internal/briefs/260727_fence_id_v1.0.md`
- Build order: `internal/checklists/fence-build-order.md`
- Full architecture detail: this repo's `CLAUDE.md`

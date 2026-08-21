# packages

Public, versioned packages Fence publishes — an npm-workspaces monorepo, renamed from `contracts` 2026-08-21 when this became a home for more than one package.

## Packages

- **`packages/contracts`** (`@fence.dev/contracts`) — the shared, versioned schemas every other repo imports: the passport, mandate, `verify()` request, and `verify()` decision shapes (the M·1–M·4 seam, App. C).
- **`packages/credential-verification`** (`@fence.dev/credential-verification`) — verifies a Fence-issued passport's signature and offline revocation status against Fence's published did:web keys. Ported from `verification`'s own internal copy (2026-08-21, external duplication review) — the same logic Fence's own verification service uses, now independently auditable and installable by a relying party instead of only existing as a black box behind `verify()`.

**Why public:** these are the interoperability surface third parties build against. For genuinely internal-only shared code (used only by Fence's own services, never meant for a third party to see), see the separate, private `internal-packages` repo instead — see this repo's own `CLAUDE.md` for the full public/private split rationale.

## Reference

- Product brief: `internal/briefs/260727_fence_id_v1.0.md`
- Build order: `internal/checklists/fence-build-order.md`
- Full architecture detail: this repo's `CLAUDE.md`

# contracts

Owns the shared, versioned contracts every other repo imports — the passport, mandate, verify() request, and verify() decision shapes.

## Owns

the four M·1–M·4 shapes from the brief — the passport (SD-JWT-VC payload), the mandate, the `verify()` request, the `verify()` decision. This is the seam every other repo builds against (App. C).

## Does not own

any business logic, any persistence, any HTTP handling — those all live in the consuming repos.

## Reference

- Product brief: `internal/briefs/260727_fence_id_v1.0.md`
- Build order: `internal/checklists/fence-build-order.md`
- Full architecture detail: this repo's `CLAUDE.md`

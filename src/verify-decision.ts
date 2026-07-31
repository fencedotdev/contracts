import { z } from "zod";
import { AssuranceLevelSchema } from "./assurance-level.js";
import { EnvironmentSchema } from "./environment.js";

// M·4 — the verify() decision. A signed authorization decision the relying
// party can store for audit — the single response shape that serves every
// enforcement mode.
// Brief: internal/briefs/260727_fence_id_v1.0.md, Appendix M·4.

// outcome (the honest verdict) and effective (was it enforced) are kept
// separate — this is the enforcement-mode seam grace slots into later
// (effective:false plus a graceUntil deadline), with no new response shape.
const DecisionBodySchema = z.object({
  outcome: z.enum(["allow", "deny"]),
  effective: z.boolean(),
  mode: z.enum(["monitor", "enforce"]),
  // Machine-readable, RP-facing. Must be sanitised before reaching the
  // subject — never surface an AML/sanctions reason to the agent or its
  // entity (tipping-off), the credential-facing message stays generic.
  reasonCodes: z.array(z.string()),
});

const EntitySchema = z.object({
  domain: z.string(),
  legalName: z.string().optional(),
  registrationNumber: z.string().optional(),
  jurisdiction: z.string().optional(),
});

const SubjectSchema = z.object({
  agent: z.string(),
  entity: EntitySchema,
  // The exposure dashboard's field — grading agents unverified/full is a
  // GROUP BY subject.assuranceLevel over logged decisions.
  assuranceLevel: AssuranceLevelSchema,
  environment: EnvironmentSchema,
});

const ClaimsSchema = z.object({
  accountableOrigin: z.boolean(),
  authenticBinding: z.boolean(),
  inScope: z.boolean(),
  compliant: z.boolean(),
  status: z.enum(["active", "revoked", "expired", "unknown"]),
});

// Coarse for now, the reputation score slots in here later. Optional:
// 0.6.2 already scopes risk_tier as internal/logged-only, not part of the
// MSVP's RP-facing response — a live response that correctly omits it must
// still validate against this schema, not fail it.
const RiskSchema = z.object({
  tier: z.string(),
});

const ProofSchema = z.object({
  type: z.string(),
  jws: z.string(),
});

const VerifyDecisionShapeSchema = z.object({
  decision: DecisionBodySchema,
  subject: SubjectSchema,
  claims: ClaimsSchema,
  risk: RiskSchema.optional(),
  checkedAt: z.iso.datetime(),
  // OUR signature over the decision — non-repudiable, auditable; what makes
  // a "for a regulated purpose" tier chargeable (Appendix H).
  proof: ProofSchema,
});

// accountableOrigin is computed per assurance tier, not asserted uniformly
// (build-order decision #15): true only for a full-assurance agent, always
// false for unverified, since nothing has confirmed a real, liable entity
// stands behind an unverified claim. Enforced here, at the schema level —
// an instance violating this is not a valid decision, not just a bug for
// verification's application code to avoid.
export const VerifyDecisionSchema = VerifyDecisionShapeSchema.refine(
  (value) => !(value.subject.assuranceLevel === "unverified" && value.claims.accountableOrigin),
  {
    message: "accountableOrigin must be false when subject.assuranceLevel is 'unverified'",
    path: ["claims", "accountableOrigin"],
  },
);

export type VerifyDecision = z.infer<typeof VerifyDecisionSchema>;

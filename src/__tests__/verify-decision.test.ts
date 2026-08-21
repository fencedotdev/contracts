import { describe, expect, it } from "vitest";
import { verifyDecisionFixture } from "../fixtures.js";
import { VerifyDecisionModeSchema, VerifyDecisionOutcomeSchema, VerifyDecisionSchema } from "../verify-decision.js";

// Checklist: identity-kyb's verify_decisions.outcome/.mode Postgres enums
// are hand-synced to this schema's own outcome/mode values (11-lens code
// review, Medium finding M4) — exported here as named schemas, not left
// as anonymous inline z.enum()s inside DecisionBodySchema, specifically
// so a consumer can import the real source of truth and derive its own
// expectation from it, rather than hardcoding a second copy that could
// silently drift. Same "export the shared primitive" precedent as
// AssuranceLevelSchema/EnvironmentSchema.
describe("VerifyDecisionOutcomeSchema / VerifyDecisionModeSchema", () => {
  it("exposes the exact outcome values consuming repos' DB enums must match", () => {
    expect(VerifyDecisionOutcomeSchema.options).toEqual(["allow", "deny"]);
  });

  it("exposes the exact mode values consuming repos' DB enums must match", () => {
    expect(VerifyDecisionModeSchema.options).toEqual(["monitor", "enforce"]);
  });
});

describe("VerifyDecisionSchema", () => {
  it("accepts the canonical fixture", () => {
    expect(VerifyDecisionSchema.safeParse(verifyDecisionFixture).success).toBe(true);
  });

  it("accepts an instance with risk omitted entirely", () => {
    const withoutRisk = { ...verifyDecisionFixture };
    delete withoutRisk.risk;

    expect(VerifyDecisionSchema.safeParse(withoutRisk).success).toBe(true);
  });

  it("never validates an unverified-tier decision with accountableOrigin: true, regardless of other claims", () => {
    const invalid = {
      ...verifyDecisionFixture,
      subject: { ...verifyDecisionFixture.subject, assuranceLevel: "unverified" },
      claims: { ...verifyDecisionFixture.claims, accountableOrigin: true, compliant: true, inScope: true },
    };

    expect(VerifyDecisionSchema.safeParse(invalid).success).toBe(false);
  });

  it("validates an unverified-tier decision with accountableOrigin: false", () => {
    const valid = {
      ...verifyDecisionFixture,
      subject: { ...verifyDecisionFixture.subject, assuranceLevel: "unverified" },
      claims: { ...verifyDecisionFixture.claims, accountableOrigin: false },
    };

    expect(VerifyDecisionSchema.safeParse(valid).success).toBe(true);
  });
});

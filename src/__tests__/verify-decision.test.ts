import { describe, expect, it } from "vitest";
import { verifyDecisionFixture } from "../fixtures.js";
import { VerifyDecisionSchema } from "../verify-decision.js";

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

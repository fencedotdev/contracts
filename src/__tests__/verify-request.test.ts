import { describe, expect, it } from "vitest";
import { verifyRequestFixture } from "../fixtures.js";
import { VerifyRequestSchema } from "../verify-request.js";

describe("VerifyRequestSchema", () => {
  it("accepts the canonical fixture", () => {
    expect(VerifyRequestSchema.safeParse(verifyRequestFixture).success).toBe(true);
  });

  it("accepts an action.type value not in any fixed list — it's a free string, not an enum", () => {
    const futureActionType = {
      ...verifyRequestFixture,
      action: { ...verifyRequestFixture.action, type: "some-future-action-type" },
    };

    expect(VerifyRequestSchema.safeParse(futureActionType).success).toBe(true);
  });

  it("rejects mode outside monitor/enforce (grace is not yet a valid value)", () => {
    const invalid = {
      ...verifyRequestFixture,
      policy: { ...verifyRequestFixture.policy, mode: "grace" },
    };

    expect(VerifyRequestSchema.safeParse(invalid).success).toBe(false);
  });
});

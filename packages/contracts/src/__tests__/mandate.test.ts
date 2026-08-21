import { describe, expect, it } from "vitest";
import { mandateFixture } from "../fixtures.js";
import { MandateSchema } from "../mandate.js";

describe("MandateSchema", () => {
  it("accepts the canonical fixture", () => {
    expect(MandateSchema.safeParse(mandateFixture).success).toBe(true);
  });

  it("rejects a limit missing a required field", () => {
    const invalid = {
      ...mandateFixture,
      constraints: {
        ...mandateFixture.constraints,
        limits: [{ metric: "transaction.value", unit: "GBP" }],
      },
    };

    expect(MandateSchema.safeParse(invalid).success).toBe(false);
  });
});

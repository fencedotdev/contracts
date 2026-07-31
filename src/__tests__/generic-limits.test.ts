import { describe, expect, it } from "vitest";
import { mandateFixture } from "../fixtures.js";
import { MandateSchema } from "../mandate.js";

// 0.5.3 — proves a payment-shaped limit and an API-quota-shaped limit are
// literally the same structure, just different metric values. There is no
// separate "payment limit" type to keep in sync — this is what makes
// Prong 2 (if it ever ships) an addition of new metric values, not a new
// object.
describe("mandate limits are metric-generic, not payment-specific", () => {
  it("accepts a payment-shaped limit (transaction.value) and an API-quota-shaped limit (requests.count) in the same array", () => {
    const withBoth = {
      ...mandateFixture,
      constraints: {
        ...mandateFixture.constraints,
        limits: [
          { metric: "transaction.value", unit: "GBP", max: 500 },
          { metric: "requests.count", unit: "per-day", max: 5000 },
        ],
      },
    };

    expect(MandateSchema.safeParse(withBoth).success).toBe(true);
  });

  it("accepts an arbitrary future metric with no schema change — metric is a free string, not an enum", () => {
    const futureMetric = {
      ...mandateFixture,
      constraints: {
        ...mandateFixture.constraints,
        limits: [{ metric: "some.future.metric", unit: "widgets", max: 10 }],
      },
    };

    expect(MandateSchema.safeParse(futureMetric).success).toBe(true);
  });
});

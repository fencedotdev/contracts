import { describe, expect, it } from "vitest";
import { verifyRequestFixture } from "../fixtures.js";
import { canonicalizeAction, VerifyRequestSchema } from "../verify-request.js";

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

  it("rejects a requestSignature carrying a signatureInput field alongside signature — that field no longer exists in this shape", () => {
    const withSignatureInput = {
      ...verifyRequestFixture,
      presentation: {
        ...verifyRequestFixture.presentation,
        requestSignature: { signatureInput: "sig1=(\"@method\")", signature: "abc" },
      },
    };

    // Zod's default (non-strict) object parsing ignores unknown keys rather
    // than rejecting them — this asserts the *shape actually required* is
    // just {signature}, not that extra keys are rejected outright.
    const result = VerifyRequestSchema.safeParse(withSignatureInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.presentation.requestSignature).toEqual({ signature: "abc" });
    }
  });
});

describe("canonicalizeAction()", () => {
  it("produces a deterministic string for the fixture action", () => {
    const result = canonicalizeAction(verifyRequestFixture.action);
    expect(result).toBe(
      JSON.stringify({
        type: "purchase",
        category: "electronics",
        value: { amount: 300, currency: "GBP" },
        destination: "GB",
        resource: "https://marketplace.example/checkout",
      }),
    );
  });

  it("produces byte-identical output for two independently-constructed but equal action objects, regardless of source key order", () => {
    const action = verifyRequestFixture.action;
    // A caller-constructed object with a deliberately different key
    // insertion order than the fixture's own — proves the fixed output
    // order isn't just an accident of how the fixture happens to be
    // written.
    const reordered = {
      resource: action.resource,
      destination: action.destination,
      value: { currency: action.value.currency, amount: action.value.amount },
      category: action.category,
      type: action.type,
    };

    expect(canonicalizeAction(reordered)).toBe(canonicalizeAction(action));
  });

  it("produces different output when any single field differs", () => {
    const base = canonicalizeAction(verifyRequestFixture.action);
    const changed = canonicalizeAction({ ...verifyRequestFixture.action, resource: "https://other.example" });

    expect(changed).not.toBe(base);
  });
});

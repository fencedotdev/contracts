import { describe, expect, it } from "vitest";
import { Gate2ConsentCopy } from "../gate2-consent.js";

// Checklist 1.4.1 — the checkout-facing copy this item's own text
// requires be exported as one versioned constant, the same discipline
// 1.1.11's AssuranceLevelCopy already established. This file only guards
// the constant's own content; consuming a stale version is what
// consent_copy_version exists to make detectable at the DB layer.

describe("Gate2ConsentCopy", () => {
  it("states the cooling-off consent text verbatim, with a version string", () => {
    expect(Gate2ConsentCopy.coolingOffConsent.label).toBe(
      "I want verification to begin immediately and understand I lose any right to cancel this order",
    );
    expect(Gate2ConsentCopy.coolingOffConsent.version).toBe("2026-08-03-interim-v1");
  });

  it("states the already-reviewed FX-disclosure text verbatim, with a version string", () => {
    expect(Gate2ConsentCopy.fxDisclosure.text).toBe(
      "This charge is billed in GBP (£). If your card was issued outside the UK, your card issuer may apply its own currency conversion and a foreign transaction fee — Fence has no visibility into or control over that fee.",
    );
    expect(Gate2ConsentCopy.fxDisclosure.version).toBe("2026-08-01-v1");
  });

  it("states the unclaimed-refund-window text, with a version string", () => {
    expect(Gate2ConsentCopy.unclaimedRefundWindow.text).toContain("90 days");
    expect(Gate2ConsentCopy.unclaimedRefundWindow.version).toBe("2026-08-17-interim-v1");
  });

  it("gives every field a distinct version string, so consent_copy_version always identifies exactly one of these", () => {
    const versions = [
      Gate2ConsentCopy.coolingOffConsent.version,
      Gate2ConsentCopy.fxDisclosure.version,
      Gate2ConsentCopy.unclaimedRefundWindow.version,
    ];
    expect(new Set(versions).size).toBe(versions.length);
  });
});

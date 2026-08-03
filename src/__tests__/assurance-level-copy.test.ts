import { describe, expect, it } from "vitest";
import { AssuranceLevelCopy } from "../assurance-level.js";

// Checklist 1.1.11 — the single most load-bearing sentence in the
// product's positioning, drafted as real text rather than left as an
// instruction to draft it later. Every surface that renders an assurance
// level must import this constant, never paraphrase — enforced as a
// cross-cutting regression test once real UI surfaces exist (1.11.6); this
// file only guards the constant's own content.

describe("AssuranceLevelCopy", () => {
  it("gives each tier a distinct label gloss, ten words or fewer", () => {
    expect(AssuranceLevelCopy.label.unverified).toBe("domain-confirmed only");
    expect(AssuranceLevelCopy.label.full).toBe("KYB/KYC-verified");
    for (const label of Object.values(AssuranceLevelCopy.label)) {
      expect(label.split(/\s+/).length).toBeLessThanOrEqual(10);
    }
  });

  it("states the tooltip covering both tiers and the no-reliance disclaimer, checked verbatim", () => {
    expect(AssuranceLevelCopy.tooltip).toBe(
      "unverified means Fence has confirmed control of this company's domain and nothing more — it is not a finding against the company. full means a licensed provider has verified the company's registration and its directors' identities. Neither level says the company is safe to transact with — Fence presents evidence, the relying party decides.",
    );
  });

  it("expands the tooltip into a full paragraph with one worked example per tier", () => {
    expect(AssuranceLevelCopy.paragraph).toContain(AssuranceLevelCopy.tooltip);
    // One worked example per tier, distinguishable by which fact each
    // names — not just a repeat of the tooltip's own generic language.
    expect(AssuranceLevelCopy.paragraph).toMatch(/unverified.*only confirmed control of/i);
    expect(AssuranceLevelCopy.paragraph).toMatch(/full.*registration and its directors/i);
  });

  it("never asserts risk, trust, or approval — the governing principle checked directly", () => {
    const allCopy = [
      ...Object.values(AssuranceLevelCopy.label),
      AssuranceLevelCopy.tooltip,
      AssuranceLevelCopy.paragraph,
    ].join(" ");
    for (const bannedWord of ["trusted", "risk-free", "secure", "approved", "certified", "guarantee"]) {
      expect(allCopy.toLowerCase()).not.toContain(bannedWord);
    }
    // "safe" appears twice — once in the tooltip, once more where the
    // paragraph embeds that same tooltip text — and only ever to
    // explicitly deny the claim. A bare ban would also reject the
    // sentence doing the denying.
    expect(allCopy).toContain("Neither level says the company is safe to transact with");
    expect(allCopy.toLowerCase().split("safe").length - 1).toBe(2);
  });

  it("states the no-reliance disclaimer identically in both the tooltip and the paragraph", () => {
    const disclaimer = "Fence presents evidence, the relying party decides.";
    expect(AssuranceLevelCopy.tooltip).toContain(disclaimer);
    expect(AssuranceLevelCopy.paragraph).toContain(disclaimer);
  });
});

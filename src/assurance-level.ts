import { z } from "zod";

// Shared across the passport (M·1), the verify() request's policy (M·3),
// and the verify() decision (M·4). No "basic" tier in the MSVP — retired,
// build-order decision #12 (fence-checklist-phase-0.md 0.6.2).
export const AssuranceLevelSchema = z.enum(["unverified", "full"]);

export type AssuranceLevel = z.infer<typeof AssuranceLevelSchema>;

// Checklist 1.1.11 — the canonical, positioning-checked assurance-level
// copy, drafted once here rather than paraphrased per surface. Every
// screen that renders an assurance level (console, the credential viewer,
// checkout, the §1.10 demo, all §1.12 diagrams) must import this constant
// directly — never restate it, even approximately. Checked against the
// governing principle: Fence proves accountability, not risk.
const disclaimer = "Fence presents evidence, the relying party decides.";

const tooltip =
  "unverified means Fence has confirmed control of this company's domain and nothing more — it is not a finding against the company. " +
  "full means a licensed provider has verified the company's registration and its directors' identities. " +
  `Neither level says the company is safe to transact with — ${disclaimer}`;

export const AssuranceLevelCopy = {
  // Label gloss — ten words or fewer, for a chip/badge.
  label: {
    unverified: "domain-confirmed only",
    full: "KYB/KYC-verified",
  },
  // Tooltip — the copy shown on hover/focus wherever an assurance level
  // appears. Covers both tiers together plus the no-reliance disclaimer,
  // since a reader comparing two companies needs both meanings at once.
  tooltip,
  // Full paragraph — the tooltip expanded with one worked example per
  // tier, for diagrams and docs where there's room for it. Reuses the
  // brand guidelines' own illustrative fixtures (Northwind Trading Ltd /
  // Halden Systems Ltd) for continuity with the rest of the design system.
  paragraph:
    `${tooltip} ` +
    "For example: Northwind Trading Ltd, at unverified, has only confirmed control of northwind.example — no company registration or director checks have been run. " +
    "Halden Systems Ltd, at full, has had its registration and its directors' identities verified by a licensed provider as of a stated date.",
} as const;

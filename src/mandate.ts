import { z } from "zod";

// M·2 — the mandate/scope. Generic, payment-agnostic authority: expressed
// as limits, categories, destinations, and expiry, so a spend cap and an
// API quota are the same structure with different metrics. Prong 2 (if it
// ever ships) adds payment metrics, not a new object.
// Brief: internal/briefs/260727_fence_id_v1.0.md, Appendix M·2.

const AllowDenyListSchema = z.object({
  allow: z.array(z.string()),
  deny: z.array(z.string()),
});

// GENERIC { metric, unit, max } — metric is a free string on purpose.
// "transaction.value" and "requests.count" are the same shape; never add a
// payment-specific limit type.
const LimitSchema = z.object({
  metric: z.string(),
  unit: z.string(),
  max: z.number(),
});

const ConstraintsSchema = z.object({
  categories: AllowDenyListSchema,
  limits: z.array(LimitSchema),
  destinations: AllowDenyListSchema,
  counterparties: AllowDenyListSchema,
});

export const MandateSchema = z.object({
  id: z.string(),
  agent: z.string(),
  grantedBy: z.string(),
  validFrom: z.iso.datetime(),
  validUntil: z.iso.datetime(),
  purpose: z.string(),
  constraints: ConstraintsSchema,
});

export type Mandate = z.infer<typeof MandateSchema>;

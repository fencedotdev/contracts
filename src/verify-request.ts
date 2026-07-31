import { z } from "zod";
import { AssuranceLevelSchema } from "./assurance-level.js";

// M·3 — the verify() request. What a relying party sends once an agent has
// presented its passport and signed its request.
// Brief: internal/briefs/260727_fence_id_v1.0.md, Appendix M·3.

const PresentationSchema = z.object({
  // The VC-JWT itself, or a reference the verifier resolves.
  passport: z.string(),
  // RFC 9421 HTTP Message Signatures — proves key possession.
  requestSignature: z.object({
    signatureInput: z.string(),
    signature: z.string(),
  }),
});

// type is a free string on purpose, not an enum — "purchase" today must
// not block a future "payment" type without a schema migration.
const ActionSchema = z.object({
  type: z.string(),
  category: z.string(),
  value: z.object({
    amount: z.number(),
    currency: z.string(),
  }),
  destination: z.string(),
  resource: z.string(),
});

// mode omits "grace" for now — it slots in later as effective:false plus a
// graceUntil deadline on the decision (M·4), no new request shape needed.
const PolicySchema = z.object({
  requiredLevel: AssuranceLevelSchema,
  mode: z.enum(["monitor", "enforce"]),
});

export const VerifyRequestSchema = z.object({
  presentation: PresentationSchema,
  action: ActionSchema,
  policy: PolicySchema,
});

export type VerifyRequest = z.infer<typeof VerifyRequestSchema>;

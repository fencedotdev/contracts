import { z } from "zod";
import { AssuranceLevelSchema } from "./assurance-level.js";

// M·3 — the verify() request. What a relying party sends once an agent has
// presented its passport and signed its request.
// Brief: internal/briefs/260727_fence_id_v1.0.md, Appendix M·3.

const PresentationSchema = z.object({
  // The VC-JWT itself, or a reference the verifier resolves.
  passport: z.string(),
  // Proves key possession over this exact action — see canonicalizeAction()
  // below. No separate signatureInput field: the verifier reconstructs the
  // signed string itself from `action` (already present in this same
  // request) rather than trusting a caller-supplied description of what
  // was signed. Corrected from an earlier RFC 9421-header-shaped design
  // (signatureInput + signature) once it became clear verification never
  // sees the agent's real request to the relying party, so a generic
  // HTTP-message-signature transport couldn't be verified faithfully
  // anyway — see internal/checklists/fence-build-order.md's Open scope
  // decision #29 for the full reasoning and what's still deferred (an
  // agent proving its *actual* request to the relying party, not just
  // this canonicalized action, needs verifier-sdk forwarding real
  // request data or a Content-Digest — not built yet).
  requestSignature: z.object({
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

export type Action = z.infer<typeof ActionSchema>;

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

// The one canonicalization rule every signer (an agent) and every verifier
// (verification's request-signature-verification.ts) must produce
// byte-identical output from, for the same action, independently. An
// explicit, fixed key order — not a spread of the caller's own object,
// whose insertion order isn't guaranteed to match between two independent
// implementations — is what makes that possible without a general-purpose
// canonicalization scheme (e.g. RFC 8785 JCS): action's shape is fixed and
// known, not arbitrary JSON, so a hand-written fixed order is sufficient
// and avoids pulling in machinery this specific, narrow need doesn't
// require.
export function canonicalizeAction(action: Action): string {
  return JSON.stringify({
    type: action.type,
    category: action.category,
    value: { amount: action.value.amount, currency: action.value.currency },
    destination: action.destination,
    resource: action.resource,
  });
}

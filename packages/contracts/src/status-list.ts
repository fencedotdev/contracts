import { z } from "zod";

// The published revocation status list — a real W3C BitstringStatusListCredential,
// signed by scope-policy's status-signing key, consulted by verification as a
// second, defense-in-depth signal alongside the still-authoritative online DB
// check. Pulled forward from Phase 4 by founder decision, 2026-08-14 — see
// internal/briefs/260814_status-list-freshness-policy-pull-forward.md.

const StatusListContextSchema = z.tuple([
  z.literal("https://www.w3.org/ns/credentials/v2"),
  z.literal("https://fence.dev/ctx/v1"),
]);

const StatusListTypeSchema = z.tuple([z.literal("VerifiableCredential"), z.literal("BitstringStatusListCredential")]);

const CredentialSubjectSchema = z.object({
  // The status list credential's own URL — the same value a passport's
  // credentialStatus.statusListCredential field points at.
  id: z.string(),
  type: z.literal("BitstringStatusList"),
  statusPurpose: z.literal("revocation"),
  // GZIP-compressed, Multibase-base64url-encoded bitstring.
  encodedList: z.string(),
  // Seconds — mirrors this credential's own Cache-Control: max-age.
  ttl: z.number(),
});

// Mirrors verify-decision.ts's ProofSchema exactly — not imported, since
// that one is a private, unexported building block there too; each signed
// shape declares its own proof field rather than sharing a cross-shape type
// that would couple two otherwise-independent credentials.
const ProofSchema = z.object({
  type: z.string(),
  jws: z.string(),
});

export const BitstringStatusListCredentialSchema = z.object({
  "@context": StatusListContextSchema,
  type: StatusListTypeSchema,
  issuer: z.string(),
  validFrom: z.iso.datetime(),
  credentialSubject: CredentialSubjectSchema,
  // Required, unlike passport.ts's credentialStatus (which only points at
  // this credential) — this IS the signed document, so an instance with no
  // proof isn't a valid, trustable list, just an unsigned draft of one.
  proof: ProofSchema,
});

export type BitstringStatusListCredential = z.infer<typeof BitstringStatusListCredentialSchema>;

// The one shared function both scope-policy's signer and verification's
// verifier import, mirroring canonicalizeAction()'s existing role for the
// decision-signing path exactly — two independent implementations with no
// shared canonicalization risk either silently no-op'ing the whole feature,
// or worse, a proof that never actually authenticates encodedList. An
// explicit, fixed key order (not a spread of the caller's own object) is
// what makes byte-identical output possible between two independent
// implementations without a general-purpose scheme like RFC 8785 JCS — this
// shape is fixed and known, not arbitrary JSON.
//
// proof is deliberately excluded: it's computed over this canonicalized
// string, so it cannot be part of its own input.
export function canonicalizeStatusList(credential: BitstringStatusListCredential): string {
  return JSON.stringify({
    "@context": credential["@context"],
    type: credential.type,
    issuer: credential.issuer,
    validFrom: credential.validFrom,
    credentialSubject: {
      id: credential.credentialSubject.id,
      type: credential.credentialSubject.type,
      statusPurpose: credential.credentialSubject.statusPurpose,
      encodedList: credential.credentialSubject.encodedList,
      ttl: credential.credentialSubject.ttl,
    },
  });
}

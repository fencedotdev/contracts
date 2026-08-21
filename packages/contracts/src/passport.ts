import { z } from "zod";
import { AssuranceLevelSchema } from "./assurance-level.js";
import { EnvironmentSchema } from "./environment.js";

// M·1 — the passport. A W3C Verifiable Credential in SD-JWT-VC format,
// signed by the issuer key in KMS; the public half resolves via did:web.
// Brief: internal/briefs/260727_fence_id_v1.0.md, Appendix M·1.

const PassportContextSchema = z.tuple([
  z.literal("https://www.w3.org/ns/credentials/v2"),
  z.literal("https://fence.dev/ctx/v1"),
]);

const PassportTypeSchema = z.tuple([z.literal("VerifiableCredential"), z.literal("FencePassport")]);

const CredentialStatusSchema = z.object({
  type: z.literal("BitstringStatusListEntry"),
  statusPurpose: z.literal("revocation"),
  statusListIndex: z.string(),
  statusListCredential: z.string(),
});

// legalName/registrationNumber/jurisdiction are absent for an unverified
// passport — populated only once IDV confirms KYB (build-order decision
// #15). domain is always populated, from signup, regardless of tier.
const ControllerSchema = z.object({
  id: z.string(),
  domain: z.string(),
  legalName: z.string().optional(),
  registrationNumber: z.string().optional(),
  jurisdiction: z.string().optional(),
});

// Mirrors identity-kyb's kyb_status/kyc_status vocabulary (declared
// independently here — contracts has no dependency on any other repo).
const KybKycStatusSchema = z.enum(["not_started", "pending", "verified", "rejected"]);

// kyb/kyc/verifiedAt are optional for the same reason controller's KYB
// fields are: nothing has been confirmed yet for an unverified passport,
// so there's nothing honest to report in them.
const AssuranceSchema = z.object({
  level: AssuranceLevelSchema,
  kyb: KybKycStatusSchema.optional(),
  kyc: KybKycStatusSchema.optional(),
  verifiedAt: z.iso.datetime().optional(),
});

// A raw JWK — kept generic rather than modelling every key-type variant
// (OKP/EC/RSA) since this is a v0 shape, not a frozen spec.
const AgentKeySchema = z.object({
  kid: z.string(),
  publicKeyJwk: z.record(z.string(), z.unknown()),
});

// The mandate is referenced, not embedded — scope changes far more often
// than the KYB binding, so an entity can re-scope an agent without
// re-issuing the passport or re-running KYC.
const CredentialSubjectSchema = z.object({
  id: z.string(),
  type: z.literal("Agent"),
  controller: ControllerSchema,
  assurance: AssuranceSchema,
  agentKey: AgentKeySchema,
  mandateRef: z.string(),
});

export const PassportSchema = z.object({
  "@context": PassportContextSchema,
  type: PassportTypeSchema,
  id: z.string(),
  issuer: z.string(),
  environment: EnvironmentSchema,
  validFrom: z.iso.datetime(),
  validUntil: z.iso.datetime(),
  credentialStatus: CredentialStatusSchema,
  credentialSubject: CredentialSubjectSchema,
});

export type Passport = z.infer<typeof PassportSchema>;

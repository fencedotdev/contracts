import type { Mandate } from "./mandate.js";
import type { Passport } from "./passport.js";
import type { BitstringStatusListCredential } from "./status-list.js";
import type { VerifyDecision } from "./verify-decision.js";
import type { VerifyRequest } from "./verify-request.js";

// One canonical, schema-valid instance per shape this package owns — used
// by this package's own tests and, per 0.5.6, by every consuming repo's
// contract test to confirm it can still parse a real instance of what it
// consumes. The M·1–M·4 fixtures are kept in sync with the brief's own
// worked examples (Appendix M); statusListCredentialFixture is not one of
// M·1–M·4 (see internal/briefs/260814_status-list-freshness-policy-pull-forward.md).

export const passportFixture: Passport = {
  "@context": ["https://www.w3.org/ns/credentials/v2", "https://fence.dev/ctx/v1"],
  type: ["VerifiableCredential", "FencePassport"],
  id: "urn:uuid:9f1c1e6e-2b1a-4e7a-9c3a-0f7e8f1a2b3c",
  issuer: "did:web:fence.dev",
  environment: "live",
  validFrom: "2026-07-27T00:00:00Z",
  validUntil: "2027-07-27T00:00:00Z",
  credentialStatus: {
    type: "BitstringStatusListEntry",
    statusPurpose: "revocation",
    statusListIndex: "94567",
    statusListCredential: "https://fence.dev/status/3",
  },
  credentialSubject: {
    id: "did:web:acme-robotics.example:agents:procurement-1",
    type: "Agent",
    controller: {
      id: "did:web:acme-robotics.example",
      domain: "acme-robotics.example",
      legalName: "Acme Robotics Ltd",
      registrationNumber: "12345678",
      jurisdiction: "GB",
    },
    assurance: {
      level: "full",
      kyb: "verified",
      kyc: "verified",
      verifiedAt: "2026-07-20T00:00:00Z",
    },
    agentKey: {
      kid: "acme-proc-1",
      publicKeyJwk: { kty: "OKP", crv: "Ed25519", x: "base64url-encoded-public-key" },
    },
    mandateRef: "urn:uuid:5b2a1c4d-3e6f-4a8b-9c1d-2e3f4a5b6c7d",
  },
};

export const mandateFixture: Mandate = {
  id: "urn:uuid:5b2a1c4d-3e6f-4a8b-9c1d-2e3f4a5b6c7d",
  agent: "did:web:acme-robotics.example:agents:procurement-1",
  grantedBy: "did:web:acme-robotics.example",
  validFrom: "2026-07-27T00:00:00Z",
  validUntil: "2026-10-27T00:00:00Z",
  purpose: "procurement",
  constraints: {
    categories: { allow: ["electronics", "office-supplies"], deny: ["gambling", "adult"] },
    limits: [
      { metric: "transaction.value", unit: "GBP", max: 500 },
      { metric: "daily.value", unit: "GBP", max: 2000 },
      { metric: "requests.count", unit: "per-day", max: 5000 },
    ],
    destinations: { allow: ["GB"], deny: [] },
    counterparties: { allow: [], deny: [] },
  },
};

export const statusListCredentialFixture: BitstringStatusListCredential = {
  "@context": ["https://www.w3.org/ns/credentials/v2", "https://fence.dev/ctx/v1"],
  type: ["VerifiableCredential", "BitstringStatusListCredential"],
  issuer: "did:web:fence.dev",
  validFrom: "2026-08-14T00:00:00Z",
  credentialSubject: {
    id: "https://api-scope.fence.dev/api/status/live",
    type: "BitstringStatusList",
    statusPurpose: "revocation",
    encodedList: "uH4sIAAAAAAAAA-3BAQEAAACCIP4M6Q3wAAAAAAAAAAAAAAAAAAAAAAAAAA",
    ttl: 900,
  },
  proof: { type: "JsonWebSignature2020", jws: "base64url-encoded-jws" },
};

export const verifyRequestFixture: VerifyRequest = {
  presentation: {
    passport: "<VC-JWT>",
    requestSignature: { signature: "sig1=:base64signature:" },
  },
  action: {
    type: "purchase",
    category: "electronics",
    value: { amount: 300, currency: "GBP" },
    destination: "GB",
    resource: "https://marketplace.example/checkout",
  },
  policy: {
    requiredLevel: "full",
    mode: "enforce",
  },
};

export const verifyDecisionFixture: VerifyDecision = {
  decision: {
    outcome: "deny",
    effective: false,
    mode: "monitor",
    reasonCodes: ["scope.value_exceeded"],
  },
  subject: {
    agent: "did:web:acme-robotics.example:agents:procurement-1",
    entity: {
      domain: "acme-robotics.example",
      legalName: "Acme Robotics Ltd",
      registrationNumber: "12345678",
      jurisdiction: "GB",
    },
    assuranceLevel: "full",
    environment: "live",
  },
  claims: {
    accountableOrigin: true,
    authenticBinding: true,
    inScope: false,
    compliant: true,
    status: "active",
  },
  risk: { tier: "B" },
  checkedAt: "2026-07-27T12:00:00Z",
  proof: { type: "JsonWebSignature2020", jws: "base64url-encoded-jws" },
};

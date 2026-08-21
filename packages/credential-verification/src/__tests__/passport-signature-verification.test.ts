import { exportJWK, exportPKCS8, generateKeyPair, importPKCS8, SignJWT, type JWTHeaderParameters } from "jose";
import { describe, expect, it, vi } from "vitest";
import { resolveIssuerPublicKeyJwk, verifyPassportSignature } from "../passport-signature-verification";

// Ported from verification/src/services/passport-signature-verification.ts
// (2026-08-21, external duplication review) — this is the did:web trust
// anchor a relying party can use to independently verify a Fence-issued
// passport's signature, rather than trusting Fence's own verify() endpoint
// as a black box. Fence's own verification service now consumes this
// package instead of keeping a second copy.
//
// live and test resolve to genuinely different hosts (fence.dev vs
// sandbox.fence.dev), not the same document with a different key
// selected — Phase 0 built it this way specifically so a verifier
// resolving the wrong environment's DID gets a key that is provably not
// the right one (checklist 0.7.6's own framing). Always resolved by the
// caller's own environment argument, never by the JWT's own self-asserted
// `iss` claim — though the claim is checked too, as an extra cross-check.
//
// No access to issuance's real KMS private key exists anywhere in this
// repo, by design — so the actual positive-signature-verifies path can
// only be tested against a synthetic keypair, with a mocked fetchImpl
// returning a synthetic DID document. What CAN be proven against real,
// live infrastructure is that resolveIssuerPublicKeyJwk() genuinely
// fetches and parses fence.dev's and sandbox.fence.dev's real, currently-
// published documents.

const TEST_ISSUER = "did:web:sandbox.fence.dev";

async function synthesizeSignedPassportJwt(
  privateKeyPem: string,
  overrides: { header?: JWTHeaderParameters; issuer?: string } = {},
) {
  const privateKey = await importPKCS8(privateKeyPem, "ES256");
  // A Passport payload's issuer lives in a plain `issuer` field (the W3C
  // VC data model contracts' PassportSchema follows), not the registered
  // JWT `iss` claim — jose's own .setIssuer() sets the latter, so this
  // sets the field directly instead, matching how issuance's real
  // buildPassportPayload actually shapes it.
  return new SignJWT({ hello: "world", issuer: overrides.issuer ?? TEST_ISSUER })
    .setProtectedHeader(overrides.header ?? { alg: "ES256" })
    .sign(privateKey);
}

describe("resolveIssuerPublicKeyJwk() — real, live infrastructure", () => {
  it("fetches fence.dev's real did:web document and extracts a well-formed #issuer-key JWK", async () => {
    const jwk = await resolveIssuerPublicKeyJwk("live");
    expect(jwk).toMatchObject({ kty: "EC", crv: "P-256", alg: "ES256" });
  });

  it("fetches sandbox.fence.dev's real did:web document and extracts a well-formed #issuer-key JWK, genuinely different from the live one", async () => {
    const [liveJwk, testJwk] = await Promise.all([
      resolveIssuerPublicKeyJwk("live"),
      resolveIssuerPublicKeyJwk("test"),
    ]);
    expect(testJwk).toMatchObject({ kty: "EC", crv: "P-256", alg: "ES256" });
    expect(testJwk?.["x"]).not.toBe(liveJwk?.["x"]);
  });
});

describe("resolveIssuerPublicKeyJwk() — failure paths, synthetic", () => {
  it("propagates a real network error rather than swallowing it — this function isn't the layer that fails closed", async () => {
    const fetchImpl = vi.fn(() => Promise.reject(new Error("network down")));
    await expect(resolveIssuerPublicKeyJwk("test", fetchImpl)).rejects.toThrow("network down");
  });

  it("returns null on a non-2xx response", async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(new Response("not found", { status: 404 })));
    const jwk = await resolveIssuerPublicKeyJwk("test", fetchImpl);
    expect(jwk).toBeNull();
  });

  it("returns null when the response body isn't valid JSON", async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(new Response("not json", { status: 200 })));
    const jwk = await resolveIssuerPublicKeyJwk("test", fetchImpl);
    expect(jwk).toBeNull();
  });

  it("returns null when the document doesn't match the expected DID-document shape", async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(new Response(JSON.stringify({ not: "a did document" }), { status: 200 })));
    const jwk = await resolveIssuerPublicKeyJwk("test", fetchImpl);
    expect(jwk).toBeNull();
  });

  it("returns null when no verificationMethod entry has an #issuer-key fragment", async () => {
    const document = { verificationMethod: [{ id: "did:web:sandbox.fence.dev#decision-key", publicKeyJwk: { kty: "EC" } }] };
    const fetchImpl = vi.fn(() => Promise.resolve(new Response(JSON.stringify(document), { status: 200 })));
    const jwk = await resolveIssuerPublicKeyJwk("test", fetchImpl);
    expect(jwk).toBeNull();
  });

  it("resolves the live host (fence.dev) vs the test host (sandbox.fence.dev), never crossed", async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(new Response(JSON.stringify({ verificationMethod: [] }), { status: 200 })));
    await resolveIssuerPublicKeyJwk("live", fetchImpl);
    await resolveIssuerPublicKeyJwk("test", fetchImpl);
    expect(fetchImpl).toHaveBeenNthCalledWith(1, "https://fence.dev/.well-known/did.json");
    expect(fetchImpl).toHaveBeenNthCalledWith(2, "https://sandbox.fence.dev/.well-known/did.json");
  });
});

describe("verifyPassportSignature() — synthetic keypair, mocked fetch", () => {
  function fetchImplReturning(document: unknown) {
    return vi.fn(() => Promise.resolve(new Response(JSON.stringify(document), { status: 200 })));
  }

  function synthesizeDidDocument(publicKeyJwk: Record<string, unknown>) {
    return {
      verificationMethod: [{ id: `${TEST_ISSUER}#issuer-key`, type: "JsonWebKey2020", publicKeyJwk }],
    };
  }

  it("accepts a token genuinely signed by the key the (mocked) did:web document publishes, with a matching issuer claim", async () => {
    const { privateKey, publicKey } = await generateKeyPair("ES256", { extractable: true });
    const privateKeyPem = await exportPKCS8(privateKey);
    const publicKeyJwk = await exportJWK(publicKey);
    const token = await synthesizeSignedPassportJwt(privateKeyPem);

    const fetchImpl = fetchImplReturning(synthesizeDidDocument(publicKeyJwk));

    await expect(verifyPassportSignature(token, "test", fetchImpl)).resolves.toBe(true);
  });

  it("rejects a token signed with a different key than the one the did:web document publishes", async () => {
    const { privateKey } = await generateKeyPair("ES256", { extractable: true });
    const { publicKey: wrongPublicKey } = await generateKeyPair("ES256", { extractable: true });
    const privateKeyPem = await exportPKCS8(privateKey);
    const wrongPublicKeyJwk = await exportJWK(wrongPublicKey);
    const token = await synthesizeSignedPassportJwt(privateKeyPem);

    const fetchImpl = fetchImplReturning(synthesizeDidDocument(wrongPublicKeyJwk));

    await expect(verifyPassportSignature(token, "test", fetchImpl)).resolves.toBe(false);
  });

  it("rejects a tampered token — same key, but the signed content was altered after signing", async () => {
    const { privateKey, publicKey } = await generateKeyPair("ES256", { extractable: true });
    const privateKeyPem = await exportPKCS8(privateKey);
    const publicKeyJwk = await exportJWK(publicKey);
    const token = await synthesizeSignedPassportJwt(privateKeyPem);
    const [header, , signature] = token.split(".");
    const tamperedPayload = Buffer.from(JSON.stringify({ hello: "tampered" }), "utf8").toString("base64url");
    const tamperedToken = `${header}.${tamperedPayload}.${signature}`;

    const fetchImpl = fetchImplReturning(synthesizeDidDocument(publicKeyJwk));

    await expect(verifyPassportSignature(tamperedToken, "test", fetchImpl)).resolves.toBe(false);
  });

  it("rejects an issuer claim that doesn't match the passport's own environment — even with a genuinely valid signature", async () => {
    const { privateKey, publicKey } = await generateKeyPair("ES256", { extractable: true });
    const privateKeyPem = await exportPKCS8(privateKey);
    const publicKeyJwk = await exportJWK(publicKey);
    // Signed for real, verifiable against the right key — but claiming
    // to be the live issuer while being checked as a test-environment
    // passport. Callers always pass their own DB-sourced environment, so
    // this proves that argument stays authoritative over whatever the
    // token itself asserts.
    const token = await synthesizeSignedPassportJwt(privateKeyPem, { issuer: "did:web:fence.dev" });

    const fetchImpl = fetchImplReturning(synthesizeDidDocument(publicKeyJwk));

    await expect(verifyPassportSignature(token, "test", fetchImpl)).resolves.toBe(false);
  });

  it("rejects a non-ES256 algorithm outright (alg-confusion probe), even reusing bytes from a genuinely valid ES256 signature", async () => {
    const { privateKey, publicKey } = await generateKeyPair("ES256", { extractable: true });
    const privateKeyPem = await exportPKCS8(privateKey);
    const publicKeyJwk = await exportJWK(publicKey);
    const token = await synthesizeSignedPassportJwt(privateKeyPem);
    const forgedHeader = Buffer.from(JSON.stringify({ alg: "none" }), "utf8").toString("base64url");
    const [, payload, signature] = token.split(".");
    const forgedToken = `${forgedHeader}.${payload}.${signature}`;

    const fetchImpl = fetchImplReturning(synthesizeDidDocument(publicKeyJwk));

    await expect(verifyPassportSignature(forgedToken, "test", fetchImpl)).resolves.toBe(false);
  });

  it("returns false when resolveIssuerPublicKeyJwk resolves to null (e.g. the did:web document has no #issuer-key entry)", async () => {
    const fetchImpl = fetchImplReturning({ verificationMethod: [] });

    await expect(verifyPassportSignature("irrelevant.token.here", "test", fetchImpl)).resolves.toBe(false);
  });

  it("returns false, never throws, when resolveIssuerPublicKeyJwk itself fails (e.g. a real network error)", async () => {
    const fetchImpl = vi.fn(() => Promise.reject(new Error("network down")));

    await expect(verifyPassportSignature("irrelevant.token.here", "test", fetchImpl)).resolves.toBe(false);
  });

  it("returns false for a genuinely malformed token", async () => {
    const { publicKey } = await generateKeyPair("ES256", { extractable: true });
    const publicKeyJwk = await exportJWK(publicKey);
    const fetchImpl = fetchImplReturning(synthesizeDidDocument(publicKeyJwk));

    await expect(verifyPassportSignature("not-a-real-jwt", "test", fetchImpl)).resolves.toBe(false);
  });
});

import type { BitstringStatusListCredential } from "@fence.dev/contracts";
import { canonicalizeStatusList } from "@fence.dev/contracts";
import { exportJWK, generateKeyPair } from "jose";
import { webcrypto } from "node:crypto";
import { gzipSync } from "node:zlib";
import { describe, expect, it, vi } from "vitest";
import { checkOfflineRevocationStatus } from "../status-list-client";

// Ported from verification/src/services/status-list-client.ts (2026-08-21,
// external duplication review) — the offline, defense-in-depth revocation
// check a relying party can run independently, alongside (or instead of)
// trusting Fence's own verify() decision. Same DI-seam/fail-soft
// discipline as passport-signature-verification.ts: every failure mode
// maps to a distinct, honest `unavailableReason`, never throws, and
// canonicalizes with contracts' shared canonicalizeStatusList() rather
// than a second hand-written implementation.

const DID_WEB_URL = "https://fence.dev/.well-known/did.json";
const STATUS_LIST_URL = "https://api-scope.fence.dev/api/status/live";

function encodeBitstring(revokedIndexes: number[], sizeBits = 131072): string {
  const bytes = Buffer.alloc(Math.ceil(sizeBits / 8), 0);
  for (const index of revokedIndexes) {
    const byteIndex = Math.floor(index / 8);
    const bitOffset = index % 8;
    bytes.writeUInt8(bytes.readUInt8(byteIndex) | (0x80 >> bitOffset), byteIndex);
  }
  return `u${gzipSync(bytes).toString("base64url")}`;
}

async function generateTestKeyPair() {
  const { publicKey, privateKey } = await generateKeyPair("ES256", { extractable: true });
  const publicKeyJwk = await exportJWK(publicKey);
  return { publicKey, privateKey, publicKeyJwk };
}

async function signCredential(
  credential: Omit<BitstringStatusListCredential, "proof">,
  privateKey: CryptoKey,
): Promise<BitstringStatusListCredential> {
  const message = new TextEncoder().encode(canonicalizeStatusList({ ...credential, proof: { type: "", jws: "" } }));
  const signature = await webcrypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, privateKey, message);
  const jws = Buffer.from(signature).toString("base64url");
  return { ...credential, proof: { type: "JsonWebSignature2020", jws } };
}

function buildUnsignedCredential(encodedList: string): Omit<BitstringStatusListCredential, "proof"> {
  return {
    "@context": ["https://www.w3.org/ns/credentials/v2", "https://fence.dev/ctx/v1"],
    type: ["VerifiableCredential", "BitstringStatusListCredential"],
    issuer: "did:web:fence.dev",
    validFrom: "2026-08-15T00:00:00.000Z",
    credentialSubject: {
      id: STATUS_LIST_URL,
      type: "BitstringStatusList",
      statusPurpose: "revocation",
      encodedList,
      ttl: 900,
    },
  };
}

function didDocument(publicKeyJwk: Record<string, unknown>) {
  return {
    verificationMethod: [
      { id: "did:web:fence.dev#issuer-key", publicKeyJwk: { kty: "OKP", crv: "Ed25519", x: "unrelated" } },
      { id: "did:web:fence.dev#status-key", publicKeyJwk },
    ],
  };
}

function jsonResponse(body: unknown, init: { status?: number } = {}): Response {
  return new Response(JSON.stringify(body), { status: init.status ?? 200 });
}

describe("checkOfflineRevocationStatus()", () => {
  it("reports revoked when the bit at statusListIndex is set", async () => {
    const { privateKey, publicKeyJwk } = await generateTestKeyPair();
    const credential = await signCredential(buildUnsignedCredential(encodeBitstring([42])), privateKey);
    const fetchImpl = vi.fn((input: Parameters<typeof fetch>[0]) => {
      const url = typeof input === "string" ? input : undefined;
      return Promise.resolve(url === DID_WEB_URL ? jsonResponse(didDocument(publicKeyJwk)) : jsonResponse(credential));
    });

    const result = await checkOfflineRevocationStatus(STATUS_LIST_URL, "42", "live", fetchImpl);

    expect(result).toEqual({ status: "revoked" });
  });

  it("reports not_revoked when the bit at statusListIndex is clear", async () => {
    const { privateKey, publicKeyJwk } = await generateTestKeyPair();
    const credential = await signCredential(buildUnsignedCredential(encodeBitstring([42])), privateKey);
    const fetchImpl = vi.fn((input: Parameters<typeof fetch>[0]) => {
      const url = typeof input === "string" ? input : undefined;
      return Promise.resolve(url === DID_WEB_URL ? jsonResponse(didDocument(publicKeyJwk)) : jsonResponse(credential));
    });

    const result = await checkOfflineRevocationStatus(STATUS_LIST_URL, "7", "live", fetchImpl);

    expect(result).toEqual({ status: "not_revoked" });
  });

  it("unavailableReason: not_found when the status list itself 404s", async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(new Response(null, { status: 404 })));

    const result = await checkOfflineRevocationStatus(STATUS_LIST_URL, "1", "live", fetchImpl);

    expect(result).toEqual({ status: "unavailable", unavailableReason: "not_found" });
  });

  it("unavailableReason: network on a non-404 non-ok response", async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(new Response(null, { status: 503 })));

    const result = await checkOfflineRevocationStatus(STATUS_LIST_URL, "1", "live", fetchImpl);

    expect(result).toEqual({ status: "unavailable", unavailableReason: "network" });
  });

  it("unavailableReason: network when the fetch itself throws", async () => {
    const fetchImpl = vi.fn(() => Promise.reject(new Error("ECONNREFUSED")));

    const result = await checkOfflineRevocationStatus(STATUS_LIST_URL, "1", "live", fetchImpl);

    expect(result).toEqual({ status: "unavailable", unavailableReason: "network" });
  });

  it("unavailableReason: timeout when the fetch is aborted by AbortSignal.timeout", async () => {
    const fetchImpl = vi.fn(() => {
      const err = new DOMException("The operation was aborted due to timeout", "TimeoutError");
      return Promise.reject(err);
    });

    const result = await checkOfflineRevocationStatus(STATUS_LIST_URL, "1", "live", fetchImpl);

    expect(result).toEqual({ status: "unavailable", unavailableReason: "timeout" });
  });

  it("unavailableReason: malformed when the status list body isn't valid JSON", async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(new Response("not json", { status: 200 })));

    const result = await checkOfflineRevocationStatus(STATUS_LIST_URL, "1", "live", fetchImpl);

    expect(result).toEqual({ status: "unavailable", unavailableReason: "malformed" });
  });

  it("unavailableReason: malformed when the status list JSON doesn't match BitstringStatusListCredentialSchema", async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(jsonResponse({ not: "a credential" })));

    const result = await checkOfflineRevocationStatus(STATUS_LIST_URL, "1", "live", fetchImpl);

    expect(result).toEqual({ status: "unavailable", unavailableReason: "malformed" });
  });

  it("unavailableReason: signature_invalid when the signature doesn't verify against the resolved status-key", async () => {
    const { privateKey } = await generateTestKeyPair();
    const { publicKeyJwk: wrongPublicKeyJwk } = await generateTestKeyPair();
    const credential = await signCredential(buildUnsignedCredential(encodeBitstring([42])), privateKey);
    const fetchImpl = vi.fn((input: Parameters<typeof fetch>[0]) => {
      const url = typeof input === "string" ? input : undefined;
      return Promise.resolve(url === DID_WEB_URL ? jsonResponse(didDocument(wrongPublicKeyJwk)) : jsonResponse(credential));
    });

    const result = await checkOfflineRevocationStatus(STATUS_LIST_URL, "42", "live", fetchImpl);

    expect(result).toEqual({ status: "unavailable", unavailableReason: "signature_invalid" });
  });

  it("unavailableReason: network when the did:web document's own body isn't valid JSON", async () => {
    const { privateKey } = await generateTestKeyPair();
    const credential = await signCredential(buildUnsignedCredential(encodeBitstring([42])), privateKey);
    const fetchImpl = vi.fn((input: Parameters<typeof fetch>[0]) => {
      const url = typeof input === "string" ? input : undefined;
      return Promise.resolve(
        url === DID_WEB_URL ? new Response("not json", { status: 200 }) : jsonResponse(credential),
      );
    });

    const result = await checkOfflineRevocationStatus(STATUS_LIST_URL, "42", "live", fetchImpl);

    expect(result).toEqual({ status: "unavailable", unavailableReason: "network" });
  });

  it("unavailableReason: signature_invalid when the resolved status-key's own coordinates are malformed, so importJWK itself throws", async () => {
    const { privateKey } = await generateTestKeyPair();
    const credential = await signCredential(buildUnsignedCredential(encodeBitstring([42])), privateKey);
    const malformedPublicKeyJwk = { kty: "EC", crv: "P-256", x: "not-valid-coordinates!!", y: "not-valid-coordinates!!" };
    const fetchImpl = vi.fn((input: Parameters<typeof fetch>[0]) => {
      const url = typeof input === "string" ? input : undefined;
      return Promise.resolve(
        url === DID_WEB_URL ? jsonResponse(didDocument(malformedPublicKeyJwk)) : jsonResponse(credential),
      );
    });

    const result = await checkOfflineRevocationStatus(STATUS_LIST_URL, "42", "live", fetchImpl);

    expect(result).toEqual({ status: "unavailable", unavailableReason: "signature_invalid" });
  });

  it("unavailableReason: out_of_range when the encoded bitstring's own gzip data is corrupt", async () => {
    const { privateKey, publicKeyJwk } = await generateTestKeyPair();
    const credential = await signCredential(buildUnsignedCredential("unot-valid-gzip-data"), privateKey);
    const fetchImpl = vi.fn((input: Parameters<typeof fetch>[0]) => {
      const url = typeof input === "string" ? input : undefined;
      return Promise.resolve(url === DID_WEB_URL ? jsonResponse(didDocument(publicKeyJwk)) : jsonResponse(credential));
    });

    const result = await checkOfflineRevocationStatus(STATUS_LIST_URL, "1", "live", fetchImpl);

    expect(result).toEqual({ status: "unavailable", unavailableReason: "out_of_range" });
  });

  it("unavailableReason: signature_invalid when the credential was tampered with after signing", async () => {
    const { privateKey, publicKeyJwk } = await generateTestKeyPair();
    const credential = await signCredential(buildUnsignedCredential(encodeBitstring([42])), privateKey);
    const tampered = { ...credential, validFrom: "2099-01-01T00:00:00.000Z" };
    const fetchImpl = vi.fn((input: Parameters<typeof fetch>[0]) => {
      const url = typeof input === "string" ? input : undefined;
      return Promise.resolve(url === DID_WEB_URL ? jsonResponse(didDocument(publicKeyJwk)) : jsonResponse(tampered));
    });

    const result = await checkOfflineRevocationStatus(STATUS_LIST_URL, "42", "live", fetchImpl);

    expect(result).toEqual({ status: "unavailable", unavailableReason: "signature_invalid" });
  });

  it("unavailableReason: out_of_range when statusListIndex exceeds the decoded bitstring's length", async () => {
    const { privateKey, publicKeyJwk } = await generateTestKeyPair();
    const credential = await signCredential(buildUnsignedCredential(encodeBitstring([42])), privateKey);
    const fetchImpl = vi.fn((input: Parameters<typeof fetch>[0]) => {
      const url = typeof input === "string" ? input : undefined;
      return Promise.resolve(url === DID_WEB_URL ? jsonResponse(didDocument(publicKeyJwk)) : jsonResponse(credential));
    });

    const result = await checkOfflineRevocationStatus(STATUS_LIST_URL, "99999999", "live", fetchImpl);

    expect(result).toEqual({ status: "unavailable", unavailableReason: "out_of_range" });
  });

  it("unavailableReason: network when the did:web document fetch itself is non-ok", async () => {
    const { privateKey } = await generateTestKeyPair();
    const credential = await signCredential(buildUnsignedCredential(encodeBitstring([42])), privateKey);
    const fetchImpl = vi.fn((input: Parameters<typeof fetch>[0]) => {
      const url = typeof input === "string" ? input : undefined;
      return Promise.resolve(
        url === DID_WEB_URL ? new Response(null, { status: 503 }) : jsonResponse(credential),
      );
    });

    const result = await checkOfflineRevocationStatus(STATUS_LIST_URL, "42", "live", fetchImpl);

    expect(result).toEqual({ status: "unavailable", unavailableReason: "network" });
  });

  it("unavailableReason: network when the did:web document's JSON doesn't match DidDocumentSchema", async () => {
    const { privateKey } = await generateTestKeyPair();
    const credential = await signCredential(buildUnsignedCredential(encodeBitstring([42])), privateKey);
    const fetchImpl = vi.fn((input: Parameters<typeof fetch>[0]) => {
      const url = typeof input === "string" ? input : undefined;
      return Promise.resolve(url === DID_WEB_URL ? jsonResponse({ not: "a did document" }) : jsonResponse(credential));
    });

    const result = await checkOfflineRevocationStatus(STATUS_LIST_URL, "42", "live", fetchImpl);

    expect(result).toEqual({ status: "unavailable", unavailableReason: "network" });
  });

  it("unavailableReason: network when the did:web document has no #status-key verification method", async () => {
    const { privateKey } = await generateTestKeyPair();
    const credential = await signCredential(buildUnsignedCredential(encodeBitstring([42])), privateKey);
    const didDocumentWithoutStatusKey = {
      verificationMethod: [
        { id: "did:web:fence.dev#issuer-key", publicKeyJwk: { kty: "OKP", crv: "Ed25519", x: "unrelated" } },
      ],
    };
    const fetchImpl = vi.fn((input: Parameters<typeof fetch>[0]) => {
      const url = typeof input === "string" ? input : undefined;
      return Promise.resolve(url === DID_WEB_URL ? jsonResponse(didDocumentWithoutStatusKey) : jsonResponse(credential));
    });

    const result = await checkOfflineRevocationStatus(STATUS_LIST_URL, "42", "live", fetchImpl);

    expect(result).toEqual({ status: "unavailable", unavailableReason: "network" });
  });

  it("unavailableReason: signature_invalid when the resolved status-key isn't an EC/P-256 JWK", async () => {
    const { privateKey } = await generateTestKeyPair();
    const credential = await signCredential(buildUnsignedCredential(encodeBitstring([42])), privateKey);
    const nonEcPublicKeyJwk = { kty: "OKP", crv: "Ed25519", x: "not-actually-used" };
    const fetchImpl = vi.fn((input: Parameters<typeof fetch>[0]) => {
      const url = typeof input === "string" ? input : undefined;
      return Promise.resolve(url === DID_WEB_URL ? jsonResponse(didDocument(nonEcPublicKeyJwk)) : jsonResponse(credential));
    });

    const result = await checkOfflineRevocationStatus(STATUS_LIST_URL, "42", "live", fetchImpl);

    expect(result).toEqual({ status: "unavailable", unavailableReason: "signature_invalid" });
  });

  it("unavailableReason: out_of_range when the encoded list is missing its multibase 'u' prefix", async () => {
    const { privateKey, publicKeyJwk } = await generateTestKeyPair();
    const credential = await signCredential(buildUnsignedCredential("not-multibase-prefixed"), privateKey);
    const fetchImpl = vi.fn((input: Parameters<typeof fetch>[0]) => {
      const url = typeof input === "string" ? input : undefined;
      return Promise.resolve(url === DID_WEB_URL ? jsonResponse(didDocument(publicKeyJwk)) : jsonResponse(credential));
    });

    const result = await checkOfflineRevocationStatus(STATUS_LIST_URL, "1", "live", fetchImpl);

    expect(result).toEqual({ status: "unavailable", unavailableReason: "out_of_range" });
  });

  it("unavailableReason: out_of_range when statusListIndex is negative", async () => {
    const { privateKey, publicKeyJwk } = await generateTestKeyPair();
    const credential = await signCredential(buildUnsignedCredential(encodeBitstring([42])), privateKey);
    const fetchImpl = vi.fn((input: Parameters<typeof fetch>[0]) => {
      const url = typeof input === "string" ? input : undefined;
      return Promise.resolve(url === DID_WEB_URL ? jsonResponse(didDocument(publicKeyJwk)) : jsonResponse(credential));
    });

    const result = await checkOfflineRevocationStatus(STATUS_LIST_URL, "-1", "live", fetchImpl);

    expect(result).toEqual({ status: "unavailable", unavailableReason: "out_of_range" });
  });

  it("resolves the test environment's did:web host, not live's", async () => {
    const { privateKey, publicKeyJwk } = await generateTestKeyPair();
    const credential = await signCredential(buildUnsignedCredential(encodeBitstring([1])), privateKey);
    const fetchImpl = vi.fn((input: Parameters<typeof fetch>[0]) => {
      const url = typeof input === "string" ? input : undefined;
      return Promise.resolve(
        url === "https://sandbox.fence.dev/.well-known/did.json"
          ? jsonResponse(didDocument(publicKeyJwk))
          : jsonResponse(credential),
      );
    });

    const result = await checkOfflineRevocationStatus(STATUS_LIST_URL, "1", "test", fetchImpl);

    expect(result).toEqual({ status: "revoked" });
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://sandbox.fence.dev/.well-known/did.json",
      expect.anything(),
    );
  });

  it("defaults to the real global fetch when no fetchImpl is injected", async () => {
    // Only proves the default parameter wires through — a real network call
    // here would make this test flaky/environment-dependent, so the target
    // URL deliberately can't resolve, and the assertion is just "it didn't
    // throw, it fails soft like every other unreachable-network case."
    const result = await checkOfflineRevocationStatus(
      "https://status-list-client-test.invalid/status/live",
      "1",
      "live",
    );

    expect(result.status).toBe("unavailable");
  });
});

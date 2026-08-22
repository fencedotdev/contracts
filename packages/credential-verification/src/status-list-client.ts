import {
  BitstringStatusListCredentialSchema,
  canonicalizeStatusList,
  type BitstringStatusListCredential,
  type Environment,
} from "@fence.dev/contracts";
import { importJWK } from "jose";
import { webcrypto } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { resolveDidWebVerificationMethod } from "./passport-signature-verification.js";

// Ported from verification/src/services/status-list-client.ts (2026-08-21,
// external duplication review) — the offline, defense-in-depth revocation
// check a relying party can run independently: fetches the published
// BitstringStatusListCredential, verifies its signature via the same
// did:web trust anchor passport-signature-verification.ts uses (a
// #status-key entry alongside #issuer-key), and checks the bit at a
// passport's own statusListIndex. Never throws — every failure mode maps
// to a distinct, honest unavailableReason.
//
// Short, hard timeout budget on every network call: Fence's own
// verification service uses this on the large majority of real verify()
// traffic and must not add unbounded latency to its core revenue
// endpoint. A relying party using this package directly is free to raise
// or lower this via its own retry/timeout wrapper around the exported
// function; it isn't itself configurable, matching the one real caller
// this budget was tuned for.

const ALGORITHM = "ES256";
const STATUS_KEY_FRAGMENT = "#status-key";
const TIMEOUT_MS = 500;

export type OfflineRevocationCheckResult =
  | { status: "revoked" }
  | { status: "not_revoked" }
  | {
      status: "unavailable";
      unavailableReason: "timeout" | "network" | "not_found" | "malformed" | "signature_invalid" | "out_of_range";
    };

// Narrows the JWK to a literal kty/crv so jose's importJWK resolves to
// CryptoKey directly — an unrecognized kty/crv fails closed
// (verifyStatusListSignature returns false) rather than being silently
// accepted or guessed at. EC/P-256 is the only real case today (Fence's
// status-signing keys are EC_SIGN_P256_SHA256).
interface EcP256PublicKeyJwk {
  kty: "EC";
  crv: "P-256";
  [key: string]: unknown;
}

function isEcP256Jwk(jwk: Record<string, unknown>): jwk is EcP256PublicKeyJwk {
  return jwk["kty"] === "EC" && jwk["crv"] === "P-256";
}

// Fails closed to `false` on any failure whatsoever — malformed JWK, wrong
// key, tampered payload — mapping every one to signature_invalid at the
// caller.
async function verifyStatusListSignature(
  credential: BitstringStatusListCredential,
  publicKeyJwk: Record<string, unknown>,
): Promise<boolean> {
  try {
    if (!isEcP256Jwk(publicKeyJwk)) return false;
    const publicKey = await importJWK(publicKeyJwk, ALGORITHM);
    const signatureBytes = Buffer.from(credential.proof.jws, "base64url");
    const dataBytes = new TextEncoder().encode(canonicalizeStatusList(credential));
    return await webcrypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, publicKey, signatureBytes, dataBytes);
  } catch {
    return false;
  }
}

// Mirrors scope-policy's buildEncodedBitstring encoding in reverse:
// Multibase 'u' prefix, base64url(gzip(bitstring)), MSB-first bit order
// within a byte. Returns null (out_of_range) rather than throwing when
// statusListIndex falls outside the decoded bitstring's actual length —
// a genuinely possible case if the list's herd-privacy floor/highest
// index has shrunk relative to an older passport's index, not just a
// theoretical bound.
function isBitSet(encodedList: string, statusListIndex: number): boolean | null {
  if (!encodedList.startsWith("u")) return null;

  let bytes: Buffer;
  try {
    bytes = gunzipSync(Buffer.from(encodedList.slice(1), "base64url"));
  } catch {
    return null;
  }

  if (statusListIndex < 0) return null;
  const byteIndex = Math.floor(statusListIndex / 8);
  if (byteIndex >= bytes.length) return null;

  const bitOffset = statusListIndex % 8;
  return (bytes.readUInt8(byteIndex) & (0x80 >> bitOffset)) !== 0;
}

type FetchCredentialResult =
  | { credential: BitstringStatusListCredential }
  | { failure: "not_found" | "network" | "malformed" };

async function fetchStatusListCredential(url: string, fetchImpl: typeof fetch): Promise<FetchCredentialResult> {
  const response = await fetchImpl(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (response.status === 404) return { failure: "not_found" };
  if (!response.ok) return { failure: "network" };

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { failure: "malformed" };
  }

  const parsed = BitstringStatusListCredentialSchema.safeParse(body);
  if (!parsed.success) return { failure: "malformed" };
  return { credential: parsed.data };
}

export async function checkOfflineRevocationStatus(
  url: string,
  statusListIndex: string,
  environment: Environment,
  fetchImpl: typeof fetch = fetch,
): Promise<OfflineRevocationCheckResult> {
  try {
    const fetched = await fetchStatusListCredential(url, fetchImpl);
    if ("failure" in fetched) return { status: "unavailable", unavailableReason: fetched.failure };
    const { credential } = fetched;

    const publicKeyJwk = await resolveDidWebVerificationMethod(environment, STATUS_KEY_FRAGMENT, fetchImpl, TIMEOUT_MS);
    if (!publicKeyJwk) return { status: "unavailable", unavailableReason: "network" };

    const signatureValid = await verifyStatusListSignature(credential, publicKeyJwk);
    if (!signatureValid) return { status: "unavailable", unavailableReason: "signature_invalid" };

    const bitSet = isBitSet(credential.credentialSubject.encodedList, Number(statusListIndex));
    if (bitSet === null) return { status: "unavailable", unavailableReason: "out_of_range" };

    return { status: bitSet ? "revoked" : "not_revoked" };
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      return { status: "unavailable", unavailableReason: "timeout" };
    }
    return { status: "unavailable", unavailableReason: "network" };
  }
}

import type { Environment } from "@fence.dev/contracts";
import { importJWK, jwtVerify } from "jose";
import { z } from "zod";

// Ported from verification/src/services/passport-signature-verification.ts
// (2026-08-21, external duplication review) — this is the did:web trust
// anchor a relying party can use to independently verify a Fence-issued
// passport's signature, rather than trusting Fence's own verify() endpoint
// as a black box. Originally built as defense-in-depth for verification's
// own resolvePassport() (an Aikido finding on decodeJwt() without
// jwtVerify() prompted it); the same logic is exactly what a third party
// auditing a passport independently needs, which is why it lives here now.
//
// live and test resolve to genuinely different hosts (fence.dev vs
// sandbox.fence.dev), not the same document with a different key
// selected — Phase 0 built it this way specifically so a verifier
// resolving the wrong environment's DID gets a key that is provably not
// the right one (checklist 0.7.6's own framing). The caller always
// supplies the passport's own known environment, never the JWT's
// self-asserted `iss` claim — though that claim is checked too, as an
// extra cross-check against the caller's argument, not as the source of
// truth for which host to resolve.

const ALGORITHM = "ES256";
const ISSUER_KEY_FRAGMENT = "#issuer-key";

const DidDocumentSchema = z.object({
  verificationMethod: z.array(
    z.object({
      id: z.string(),
      publicKeyJwk: z.record(z.string(), z.unknown()),
    }),
  ),
});

function didWebHost(environment: Environment): string {
  return environment === "live" ? "fence.dev" : "sandbox.fence.dev";
}

function expectedIssuer(environment: Environment): string {
  return `did:web:${didWebHost(environment)}`;
}

// Shared by every did:web verification-method lookup in this package —
// this function's own resolveIssuerPublicKeyJwk() wrapper below
// (#issuer-key) and check-offline-revocation-status.ts's status-key
// resolution (#status-key) both go through it, so the fetch/parse/
// fragment-match logic exists in exactly one place. Deliberately doesn't
// fail closed itself — a real network error here is distinct from "the
// document was fetched but is unusable," and each caller
// (verifyPassportSignature() below, checkOfflineRevocationStatus()) is
// the layer responsible for mapping every failure mode to its own single,
// honest outcome.
export async function resolveDidWebVerificationMethod(
  environment: Environment,
  fragment: string,
  fetchImpl: typeof fetch = fetch,
  timeoutMs?: number,
): Promise<Record<string, unknown> | null> {
  const url = `https://${didWebHost(environment)}/.well-known/did.json`;
  const response =
    timeoutMs === undefined ? await fetchImpl(url) : await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) return null;

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return null;
  }

  const parsed = DidDocumentSchema.safeParse(body);
  if (!parsed.success) return null;

  const method = parsed.data.verificationMethod.find((entry) => entry.id.endsWith(fragment));
  return method?.publicKeyJwk ?? null;
}

export async function resolveIssuerPublicKeyJwk(
  environment: Environment,
  fetchImpl: typeof fetch = fetch,
): Promise<Record<string, unknown> | null> {
  return resolveDidWebVerificationMethod(environment, ISSUER_KEY_FRAGMENT, fetchImpl);
}

// Fails closed on any failure whatsoever — network error, malformed
// document, missing issuer key, wrong key, tampered payload, wrong
// algorithm, mismatched issuer claim — mapping every one of them to
// `false`, never throwing. There's only one caller-visible signal here.
export async function verifyPassportSignature(
  credentialJwt: string,
  environment: Environment,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  try {
    const publicKeyJwk = await resolveIssuerPublicKeyJwk(environment, fetchImpl);
    if (!publicKeyJwk) return false;

    const publicKey = await importJWK(publicKeyJwk, ALGORITHM);
    // Not jwtVerify's own `issuer` option — that checks the registered
    // `iss` claim, but a Passport payload's issuer lives in a plain
    // `issuer` field (the W3C VC data model contracts' PassportSchema
    // follows, not a registered JWT claim). Checked manually against the
    // already-signature-verified payload jwtVerify returns.
    const { payload } = await jwtVerify(credentialJwt, publicKey, { algorithms: [ALGORITHM] });
    return payload["issuer"] === expectedIssuer(environment);
  } catch {
    return false;
  }
}

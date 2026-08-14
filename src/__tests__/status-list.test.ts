import { describe, expect, it } from "vitest";
import { statusListCredentialFixture } from "../fixtures.js";
import { BitstringStatusListCredentialSchema, canonicalizeStatusList } from "../status-list.js";

describe("BitstringStatusListCredentialSchema", () => {
  it("accepts the canonical fixture", () => {
    expect(BitstringStatusListCredentialSchema.safeParse(statusListCredentialFixture).success).toBe(true);
  });

  it("requires proof", () => {
    const withoutProof = {
      "@context": statusListCredentialFixture["@context"],
      type: statusListCredentialFixture.type,
      issuer: statusListCredentialFixture.issuer,
      validFrom: statusListCredentialFixture.validFrom,
      credentialSubject: statusListCredentialFixture.credentialSubject,
    };

    expect(BitstringStatusListCredentialSchema.safeParse(withoutProof).success).toBe(false);
  });

  it("rejects a type tuple missing BitstringStatusListCredential", () => {
    const invalid = { ...statusListCredentialFixture, type: ["VerifiableCredential"] };

    expect(BitstringStatusListCredentialSchema.safeParse(invalid).success).toBe(false);
  });

  it("rejects credentialSubject.statusPurpose values other than revocation", () => {
    const invalid = {
      ...statusListCredentialFixture,
      credentialSubject: { ...statusListCredentialFixture.credentialSubject, statusPurpose: "suspension" },
    };

    expect(BitstringStatusListCredentialSchema.safeParse(invalid).success).toBe(false);
  });

  it("rejects credentialSubject.type values other than BitstringStatusList", () => {
    const invalid = {
      ...statusListCredentialFixture,
      credentialSubject: { ...statusListCredentialFixture.credentialSubject, type: "StatusList2021" },
    };

    expect(BitstringStatusListCredentialSchema.safeParse(invalid).success).toBe(false);
  });
});

describe("canonicalizeStatusList()", () => {
  it("produces a deterministic string for the fixture credential", () => {
    const result = canonicalizeStatusList(statusListCredentialFixture);

    expect(result).toBe(
      JSON.stringify({
        "@context": statusListCredentialFixture["@context"],
        type: statusListCredentialFixture.type,
        issuer: statusListCredentialFixture.issuer,
        validFrom: statusListCredentialFixture.validFrom,
        credentialSubject: {
          id: statusListCredentialFixture.credentialSubject.id,
          type: statusListCredentialFixture.credentialSubject.type,
          statusPurpose: statusListCredentialFixture.credentialSubject.statusPurpose,
          encodedList: statusListCredentialFixture.credentialSubject.encodedList,
          ttl: statusListCredentialFixture.credentialSubject.ttl,
        },
      }),
    );
  });

  it("excludes proof from the canonicalized output — the proof is computed over this string, so it cannot include itself", () => {
    const result = canonicalizeStatusList(statusListCredentialFixture);

    expect(result).not.toContain(statusListCredentialFixture.proof.jws);
  });

  it("produces byte-identical output for two independently-constructed but equal credentials, regardless of source key order", () => {
    const credential = statusListCredentialFixture;
    const reordered = {
      proof: credential.proof,
      credentialSubject: {
        ttl: credential.credentialSubject.ttl,
        encodedList: credential.credentialSubject.encodedList,
        statusPurpose: credential.credentialSubject.statusPurpose,
        type: credential.credentialSubject.type,
        id: credential.credentialSubject.id,
      },
      validFrom: credential.validFrom,
      issuer: credential.issuer,
      type: credential.type,
      "@context": credential["@context"],
    };

    expect(canonicalizeStatusList(reordered)).toBe(canonicalizeStatusList(credential));
  });

  it("produces different output when any single field differs", () => {
    const base = canonicalizeStatusList(statusListCredentialFixture);
    const changed = canonicalizeStatusList({
      ...statusListCredentialFixture,
      credentialSubject: { ...statusListCredentialFixture.credentialSubject, encodedList: "different-list" },
    });

    expect(changed).not.toBe(base);
  });
});

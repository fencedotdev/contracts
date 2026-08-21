import { describe, expect, it } from "vitest";
import { passportFixture } from "../fixtures.js";
import { PassportSchema } from "../passport.js";

describe("PassportSchema", () => {
  it("accepts the canonical full-assurance fixture", () => {
    expect(PassportSchema.safeParse(passportFixture).success).toBe(true);
  });

  it("accepts an unverified-tier instance with legalName/registrationNumber/jurisdiction all omitted", () => {
    const unverified = {
      ...passportFixture,
      credentialSubject: {
        ...passportFixture.credentialSubject,
        controller: {
          id: passportFixture.credentialSubject.controller.id,
          domain: passportFixture.credentialSubject.controller.domain,
        },
        assurance: { level: "unverified" },
      },
    };

    expect(PassportSchema.safeParse(unverified).success).toBe(true);
  });

  it("requires controller.domain regardless of assurance tier", () => {
    const unverifiedWithNoDomain = {
      ...passportFixture,
      credentialSubject: {
        ...passportFixture.credentialSubject,
        controller: { id: passportFixture.credentialSubject.controller.id },
        assurance: { level: "unverified" },
      },
    };

    expect(PassportSchema.safeParse(unverifiedWithNoDomain).success).toBe(false);
  });
});

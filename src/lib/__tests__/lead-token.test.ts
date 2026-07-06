import { describe, expect, it } from "vitest";
import { createHash } from "crypto";
import { generateLeadToken, hashLeadToken, verifyLeadToken } from "../lead-token";

describe("generateLeadToken", () => {
  it("returns a 32-byte base64url token", () => {
    const token = generateLeadToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("returns a different token on every call", () => {
    const seen = new Set(Array.from({ length: 20 }, () => generateLeadToken()));
    expect(seen.size).toBe(20);
  });
});

describe("hashLeadToken", () => {
  it("is the hex SHA-256 of the token", () => {
    const token = "some-token";
    expect(hashLeadToken(token)).toBe(createHash("sha256").update(token).digest("hex"));
  });
});

describe("verifyLeadToken", () => {
  it("accepts the token that produced the stored hash", () => {
    const token = generateLeadToken();
    expect(verifyLeadToken(token, hashLeadToken(token))).toBe(true);
  });

  it("rejects a different token", () => {
    expect(verifyLeadToken(generateLeadToken(), hashLeadToken(generateLeadToken()))).toBe(false);
  });

  it.each([
    ["null token", null, hashLeadToken("x")],
    ["undefined token", undefined, hashLeadToken("x")],
    ["empty token", "", hashLeadToken("x")],
    ["null stored hash", "some-token", null],
    ["undefined stored hash", "some-token", undefined],
    ["empty stored hash", "some-token", ""],
    ["malformed stored hash", "some-token", "not-hex"],
  ])("rejects %s without throwing", (_label, token, storedHash) => {
    expect(verifyLeadToken(token, storedHash)).toBe(false);
  });
});

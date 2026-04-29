import { describe, expect, it } from "vitest";
import { normalizeAgentSlug } from "../normalize-slug";

describe("normalizeAgentSlug", () => {
  describe("ok cases", () => {
    it("clean lowercase slug", () => {
      expect(normalizeAgentSlug("delbert")).toEqual({ ok: true, slug: "delbert" });
    });

    it("strips trailing newline", () => {
      expect(normalizeAgentSlug("delbert\n")).toEqual({ ok: true, slug: "delbert" });
    });

    it("strips trailing CRLF", () => {
      expect(normalizeAgentSlug("delbert\r\n")).toEqual({ ok: true, slug: "delbert" });
    });

    it("strips surrounding whitespace", () => {
      expect(normalizeAgentSlug("  delbert  ")).toEqual({ ok: true, slug: "delbert" });
    });

    it("lowercases uppercase input", () => {
      expect(normalizeAgentSlug("DELBERT")).toEqual({ ok: true, slug: "delbert" });
    });

    it("uses first element of string array (Next searchParams shape)", () => {
      expect(normalizeAgentSlug(["delbert", "liliana"])).toEqual({
        ok: true,
        slug: "delbert",
      });
    });

    it("accepts a single-character slug", () => {
      expect(normalizeAgentSlug("d")).toEqual({ ok: true, slug: "d" });
    });
  });

  describe("empty rejections", () => {
    it("empty string", () => {
      expect(normalizeAgentSlug("")).toEqual({ ok: false, reason: "empty", raw: "" });
    });

    it("null", () => {
      expect(normalizeAgentSlug(null)).toEqual({ ok: false, reason: "empty", raw: "" });
    });

    it("undefined", () => {
      expect(normalizeAgentSlug(undefined)).toEqual({ ok: false, reason: "empty", raw: "" });
    });
  });

  describe("invalid_format rejections", () => {
    it("contains internal whitespace", () => {
      expect(normalizeAgentSlug("delbert evil")).toEqual({
        ok: false,
        reason: "invalid_format",
        raw: "delbert evil",
      });
    });

    it("contains slash", () => {
      expect(normalizeAgentSlug("delbert/admin")).toEqual({
        ok: false,
        reason: "invalid_format",
        raw: "delbert/admin",
      });
    });

    it("contains emoji", () => {
      expect(normalizeAgentSlug("🎉")).toEqual({
        ok: false,
        reason: "invalid_format",
        raw: "🎉",
      });
    });

    it("starts with hyphen", () => {
      expect(normalizeAgentSlug("-delbert")).toEqual({
        ok: false,
        reason: "invalid_format",
        raw: "-delbert",
      });
    });

    it("ends with hyphen", () => {
      expect(normalizeAgentSlug("delbert-")).toEqual({
        ok: false,
        reason: "invalid_format",
        raw: "delbert-",
      });
    });
  });
});

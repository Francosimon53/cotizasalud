import { describe, expect, it } from "vitest";
import { normalizeAgentSlug } from "./normalize-slug";

describe("normalizeAgentSlug", () => {
  describe("accepts", () => {
    it("clean lowercase slug", () => {
      expect(normalizeAgentSlug("delbert")).toEqual({ ok: true, slug: "delbert" });
    });

    it("strips trailing newline (the historical bug)", () => {
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

    it("preserves internal hyphens", () => {
      expect(normalizeAgentSlug("agent-2")).toEqual({ ok: true, slug: "agent-2" });
    });

    it("accepts single-character slug", () => {
      expect(normalizeAgentSlug("a")).toEqual({ ok: true, slug: "a" });
    });

    it("accepts numeric-only slug", () => {
      expect(normalizeAgentSlug("42")).toEqual({ ok: true, slug: "42" });
    });

    it("uses first element of string array (Next searchParams shape)", () => {
      expect(normalizeAgentSlug(["delbert", "extra"])).toEqual({
        ok: true,
        slug: "delbert",
      });
    });
  });

  describe("rejects with reason 'missing'", () => {
    it("null", () => {
      expect(normalizeAgentSlug(null)).toEqual({ ok: false, reason: "missing", raw: null });
    });

    it("undefined", () => {
      expect(normalizeAgentSlug(undefined)).toEqual({ ok: false, reason: "missing", raw: undefined });
    });

    it("empty array", () => {
      expect(normalizeAgentSlug([])).toEqual({ ok: false, reason: "missing", raw: [] });
    });

    it("array with null first element", () => {
      expect(normalizeAgentSlug([null])).toMatchObject({ ok: false, reason: "missing" });
    });
  });

  describe("rejects with reason 'empty'", () => {
    it("empty string", () => {
      expect(normalizeAgentSlug("")).toEqual({ ok: false, reason: "empty", raw: "" });
    });

    it("whitespace only", () => {
      expect(normalizeAgentSlug("   ")).toMatchObject({ ok: false, reason: "empty" });
    });

    it("newline only", () => {
      expect(normalizeAgentSlug("\n")).toMatchObject({ ok: false, reason: "empty" });
    });
  });

  describe("rejects with reason 'invalid_format'", () => {
    it("contains slash", () => {
      expect(normalizeAgentSlug("delbert/")).toMatchObject({ ok: false, reason: "invalid_format" });
    });

    it("contains internal whitespace", () => {
      expect(normalizeAgentSlug("del bert")).toMatchObject({ ok: false, reason: "invalid_format" });
    });

    it("contains emoji", () => {
      expect(normalizeAgentSlug("delbert🚀")).toMatchObject({ ok: false, reason: "invalid_format" });
    });

    it("starts with hyphen", () => {
      expect(normalizeAgentSlug("-delbert")).toMatchObject({ ok: false, reason: "invalid_format" });
    });

    it("ends with hyphen", () => {
      expect(normalizeAgentSlug("delbert-")).toMatchObject({ ok: false, reason: "invalid_format" });
    });

    it("contains dot", () => {
      expect(normalizeAgentSlug("delbert.foo")).toMatchObject({ ok: false, reason: "invalid_format" });
    });
  });

  describe("rejects with reason 'invalid_type'", () => {
    it("number", () => {
      expect(normalizeAgentSlug(42)).toMatchObject({ ok: false, reason: "invalid_type" });
    });

    it("plain object", () => {
      expect(normalizeAgentSlug({ slug: "delbert" })).toMatchObject({ ok: false, reason: "invalid_type" });
    });

    it("array of non-string first element", () => {
      expect(normalizeAgentSlug([42, "delbert"])).toMatchObject({ ok: false, reason: "invalid_type" });
    });
  });

  it("preserves the raw input on rejection for telemetry", () => {
    expect(normalizeAgentSlug("delbert\n!")).toEqual({
      ok: false,
      reason: "invalid_format",
      raw: "delbert\n!",
    });
  });
});

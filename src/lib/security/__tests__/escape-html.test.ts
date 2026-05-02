import { describe, expect, it } from "vitest";
import { escapeHtml } from "../escape-html";

describe("escapeHtml", () => {
  it("escapes a script tag end-to-end", () => {
    expect(escapeHtml("<script>alert(1)</script>")).toBe(
      "&lt;script&gt;alert(1)&lt;/script&gt;"
    );
  });

  it("escapes an img with onerror handler", () => {
    expect(escapeHtml('<img src=x onerror="alert(1)">')).toBe(
      "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;"
    );
  });

  it("escapes single quote", () => {
    expect(escapeHtml("O'Brien")).toBe("O&#39;Brien");
  });

  it("escapes double quote", () => {
    expect(escapeHtml('She said "hi"')).toBe("She said &quot;hi&quot;");
  });

  it("escapes ampersand without double-encoding", () => {
    expect(escapeHtml("Tom & Jerry")).toBe("Tom &amp; Jerry");
  });

  it("escapes ampersand BEFORE other entities so '<' becomes '&lt;' not '&amp;lt;'", () => {
    // Order matters: if '&' were escaped after, '&lt;' would become '&amp;lt;'.
    // Verifies the regex applies one substitution per match without re-scanning.
    expect(escapeHtml("a < b")).toBe("a &lt; b");
    expect(escapeHtml("a > b")).toBe("a &gt; b");
    expect(escapeHtml("a & b < c")).toBe("a &amp; b &lt; c");
  });

  it("escapes < and > literals", () => {
    expect(escapeHtml("<>")).toBe("&lt;&gt;");
  });

  it("returns empty string for null", () => {
    expect(escapeHtml(null)).toBe("");
  });

  it("returns empty string for undefined", () => {
    expect(escapeHtml(undefined)).toBe("");
  });

  it("returns empty string for empty string input", () => {
    expect(escapeHtml("")).toBe("");
  });

  it("coerces and returns numbers as plain digit strings", () => {
    expect(escapeHtml(0)).toBe("0");
    expect(escapeHtml(42)).toBe("42");
    expect(escapeHtml(-3.14)).toBe("-3.14");
  });

  it("coerces booleans", () => {
    expect(escapeHtml(true)).toBe("true");
    expect(escapeHtml(false)).toBe("false");
  });

  it("passes through emojis untouched", () => {
    expect(escapeHtml("🔥 Hot lead 🚀")).toBe("🔥 Hot lead 🚀");
  });

  it("preserves astral plane characters (surrogate pair safe)", () => {
    // U+1D400 = mathematical bold capital A; surrogate pair: D835 DC00
    expect(escapeHtml("𝐀test")).toBe("𝐀test");
  });

  it("preserves accented Latin characters", () => {
    expect(escapeHtml("Liliana Vera Feo — Rúa")).toBe("Liliana Vera Feo — Rúa");
  });

  it("escapes a payload that mixes every special character", () => {
    expect(escapeHtml(`<a href='x' onclick="y">"&"</a>`)).toBe(
      "&lt;a href=&#39;x&#39; onclick=&quot;y&quot;&gt;&quot;&amp;&quot;&lt;/a&gt;"
    );
  });

  it("does not double-escape already-encoded entities (treats them as literal text)", () => {
    // Input is the literal 6 characters '&', 'l', 't', ';' etc — must double-escape
    // to '&amp;lt;' because we have no way to know the intent. Documents the contract.
    expect(escapeHtml("&lt;")).toBe("&amp;lt;");
  });
});

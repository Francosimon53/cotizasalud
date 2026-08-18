import { describe, it, expect } from "vitest";
import { normalizeName, dedupeKeyFor } from "../dedupe";

describe("normalizeName", () => {
  it("lowercases, strips accents and collapses whitespace", () => {
    expect(normalizeName("  José   PÉREZ  ")).toBe("jose perez");
    expect(normalizeName("Muñoz\tGarcía")).toBe("munoz garcia");
  });

  it("same person written differently produces the same normalized name", () => {
    expect(normalizeName("María Rodríguez")).toBe(normalizeName("maria  rodriguez"));
  });
});

describe("dedupeKeyFor", () => {
  it("prefers date_of_birth over zip", () => {
    const r = dedupeKeyFor({
      full_name: "Ana López",
      date_of_birth: "1970-05-02",
      zip_code: "33125",
    });
    expect(r).toEqual({ key: "ana lopez|d:1970-05-02", tier: "dob" });
  });

  it("falls back to zip when there is no DOB", () => {
    const r = dedupeKeyFor({ full_name: "Ana López", zip_code: " 33125 " });
    expect(r).toEqual({ key: "ana lopez|z:33125", tier: "zip" });
  });

  it("name alone is the last tier and is marked as such", () => {
    const r = dedupeKeyFor({ full_name: "Ana López" });
    expect(r).toEqual({ key: "ana lopez|n:", tier: "name_only" });
  });

  it("same name with different DOB produces different keys (no false merge)", () => {
    const a = dedupeKeyFor({ full_name: "Juan Pérez", date_of_birth: "1960-01-01" });
    const b = dedupeKeyFor({ full_name: "Juan Pérez", date_of_birth: "1985-07-15" });
    expect(a.key).not.toBe(b.key);
  });

  it("a DOB-keyed row never collides with a name-only row of the same name", () => {
    const conDob = dedupeKeyFor({ full_name: "Juan Pérez", date_of_birth: "1960-01-01" });
    const soloNombre = dedupeKeyFor({ full_name: "Juan Pérez" });
    expect(conDob.key).not.toBe(soloNombre.key);
  });
});

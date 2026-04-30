import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  PAID_PLANS,
  PLAN_CATALOG,
  getPriceId,
  getTierFromPriceId,
  getYearlySavings,
} from "../subscription-plans";

const TEST_IDS = {
  STRIPE_PRICE_BASIC: "price_basic_month_test",
  STRIPE_PRICE_BASIC_YEARLY: "price_basic_year_test",
  STRIPE_PRICE_PRO: "price_pro_month_test",
  STRIPE_PRICE_PRO_YEARLY: "price_pro_year_test",
  STRIPE_PRICE_ADVANCED: "price_advanced_month_test",
  STRIPE_PRICE_ADVANCED_YEARLY: "price_advanced_year_test",
} as const;

describe("subscription-plans helpers", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    for (const [k, v] of Object.entries(TEST_IDS)) {
      process.env[k] = v;
    }
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe("getPriceId", () => {
    it("resolves all 6 (tier × interval) combinations from env", () => {
      for (const tier of PAID_PLANS) {
        for (const interval of ["month", "year"] as const) {
          const envName = PLAN_CATALOG[tier].prices[interval].price_id_env;
          expect(getPriceId(tier, interval)).toBe(TEST_IDS[envName as keyof typeof TEST_IDS]);
        }
      }
    });

    it("returns the configured ID for basic month", () => {
      expect(getPriceId("basic", "month")).toBe("price_basic_month_test");
    });

    it("returns the configured ID for advanced year", () => {
      expect(getPriceId("advanced", "year")).toBe("price_advanced_year_test");
    });

    it("throws when the env var is missing", () => {
      delete process.env.STRIPE_PRICE_PRO_YEARLY;
      expect(() => getPriceId("pro", "year")).toThrowError(
        /STRIPE_PRICE_PRO_YEARLY/,
      );
    });

    it("throws when the env var is the empty string", () => {
      process.env.STRIPE_PRICE_BASIC = "";
      expect(() => getPriceId("basic", "month")).toThrowError(/STRIPE_PRICE_BASIC/);
    });
  });

  describe("getYearlySavings", () => {
    it("basic saves $58 (29*12 - 290)", () => {
      expect(getYearlySavings("basic")).toBe(58);
    });

    it("pro saves $158 (79*12 - 790)", () => {
      expect(getYearlySavings("pro")).toBe(158);
    });

    it("advanced saves $298 (149*12 - 1490)", () => {
      expect(getYearlySavings("advanced")).toBe(298);
    });
  });

  describe("getTierFromPriceId", () => {
    it("returns null for null/undefined/empty", () => {
      expect(getTierFromPriceId(null)).toBeNull();
      expect(getTierFromPriceId(undefined)).toBeNull();
      expect(getTierFromPriceId("")).toBeNull();
    });

    it("returns null for an unknown price ID", () => {
      expect(getTierFromPriceId("price_unknown_xyz")).toBeNull();
    });

    it("identifies a monthly basic price", () => {
      expect(getTierFromPriceId("price_basic_month_test")).toEqual({
        tier: "basic",
        interval: "month",
      });
    });

    it("identifies a yearly pro price", () => {
      expect(getTierFromPriceId("price_pro_year_test")).toEqual({
        tier: "pro",
        interval: "year",
      });
    });

    it("identifies a yearly advanced price", () => {
      expect(getTierFromPriceId("price_advanced_year_test")).toEqual({
        tier: "advanced",
        interval: "year",
      });
    });

    it("round-trips through getPriceId for every paid (tier, interval)", () => {
      for (const tier of PAID_PLANS) {
        for (const interval of ["month", "year"] as const) {
          const id = getPriceId(tier, interval);
          expect(getTierFromPriceId(id)).toEqual({ tier, interval });
        }
      }
    });
  });
});

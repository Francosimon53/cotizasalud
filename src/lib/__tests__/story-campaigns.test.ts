import { describe, expect, it } from "vitest";
import { STORY_CAMPAIGNS, getStoryCampaign } from "../story-campaigns";

describe("story campaigns", () => {
  it("has unique, URL-safe campaign keys", () => {
    const keys = STORY_CAMPAIGNS.map((story) => story.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) expect(key).toMatch(/^[a-z0-9-]+$/);
  });

  it("keeps every story composite and action-oriented", () => {
    for (const story of STORY_CAMPAIGNS) {
      expect(story.title).toBeTruthy();
      expect(story.scene).toBeTruthy();
      expect(story.turningPoint).toBeTruthy();
      expect(story.cta).toBeTruthy();
      expect(`${story.title} ${story.scene}`).not.toMatch(/\b(cliente real|testimonio real)\b/i);
    }
  });

  it("falls back safely for unknown campaign links", () => {
    expect(getStoryCampaign("not-a-real-campaign").key).toBe(STORY_CAMPAIGNS[0].key);
    expect(getStoryCampaign(null).key).toBe(STORY_CAMPAIGNS[0].key);
  });
});

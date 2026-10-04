import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  REFERRAL_SOURCE_OPTIONS,
  isReferralSourceValue,
  normalizeReferralName,
} from "@/lib/profiles/referral-source";

describe("referral source options", () => {
  it("keeps the exact display order and standardized values", () => {
    assert.deepEqual(
      REFERRAL_SOURCE_OPTIONS.map((option) => option.value),
      [
        "google",
        "instagram",
        "tiktok",
        "facebook",
        "yelp",
        "referral",
        "van",
        "other",
      ],
    );
    assert.equal(
      REFERRAL_SOURCE_OPTIONS[0]?.label,
      "Google Search / Google Maps",
    );
    assert.equal(
      REFERRAL_SOURCE_OPTIONS[5]?.label,
      "Referred by a friend or client",
    );
  });

  it("accepts only standardized source values", () => {
    assert.equal(isReferralSourceValue("google"), true);
    assert.equal(isReferralSourceValue("Google Search / Google Maps"), false);
    assert.equal(isReferralSourceValue(""), false);
  });

  it("keeps referral_name only for referral source", () => {
    assert.equal(normalizeReferralName("referral", "  Sam  "), "Sam");
    assert.equal(normalizeReferralName("referral", "   "), null);
    assert.equal(normalizeReferralName("google", "Sam"), null);
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildReferralCodeBase,
  isAccountReferralCodeFormat,
  nextReferralCodeCandidate,
  normalizeReferralCode,
  phoneLastFour,
  referralSharePath,
} from "./codes";

describe("referral codes", () => {
  it("builds first-pet name plus owner phone last four", () => {
    assert.equal(
      buildReferralCodeBase({
        petName: "Prince",
        phone: "+15615550123",
      }),
      "PRINCE0123",
    );
    assert.equal(
      buildReferralCodeBase({
        petName: "Mr. Coco",
        phone: "(561) 555-0199",
      }),
      "MRCOCO0199",
    );
  });

  it("needs at least four phone digits", () => {
    assert.equal(phoneLastFour("+15615550123"), "0123");
    assert.equal(
      buildReferralCodeBase({
        petName: "Prince",
        phone: "12",
      }),
      "",
    );
  });

  it("uses K9 when the first pet name is empty", () => {
    assert.equal(
      buildReferralCodeBase({
        petName: "   ",
        phone: "5615550123",
      }),
      "K90123",
    );
  });

  it("normalizes case, spaces, and punctuation", () => {
    assert.equal(normalizeReferralCode("  prince0123  "), "PRINCE0123");
    assert.equal(normalizeReferralCode("coco@0199"), "COCO-0199");
  });

  it("recognizes the one-code-per-account format", () => {
    assert.equal(isAccountReferralCodeFormat("PRINCE0123"), true);
    assert.equal(isAccountReferralCodeFormat("PRINCE0123-2"), true);
    assert.equal(isAccountReferralCodeFormat("PRINCE-PENNY-S"), false);
  });

  it("adds a numeric suffix when the base is taken", () => {
    assert.equal(nextReferralCodeCandidate("PRINCE0123", 1), "PRINCE0123");
    assert.equal(nextReferralCodeCandidate("PRINCE0123", 2), "PRINCE0123-2");
  });

  it("builds the booking share path", () => {
    assert.equal(referralSharePath("prince0123"), "/book?ref=PRINCE0123");
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildReferralCodeBase,
  nextReferralCodeCandidate,
  normalizeReferralCode,
  referralSharePath,
} from "./codes";

describe("referral codes", () => {
  it("builds PRINCE-PENNY-S from names", () => {
    assert.equal(
      buildReferralCodeBase({
        petName: "Prince",
        ownerFirstName: "Penny",
        ownerLastName: "Smith",
      }),
      "PRINCE-PENNY-S",
    );
  });

  it("normalizes case, spaces, and punctuation", () => {
    assert.equal(normalizeReferralCode("  prince penny-s  "), "PRINCE-PENNY-S");
    assert.equal(normalizeReferralCode("coco@penny.s"), "COCO-PENNY-S");
  });

  it("adds a numeric suffix when the base is taken", () => {
    assert.equal(nextReferralCodeCandidate("PRINCE-PENNY-S", 1), "PRINCE-PENNY-S");
    assert.equal(nextReferralCodeCandidate("PRINCE-PENNY-S", 2), "PRINCE-PENNY-S-2");
  });

  it("builds the booking share path", () => {
    assert.equal(referralSharePath("prince-penny-s"), "/book?ref=PRINCE-PENNY-S");
  });
});

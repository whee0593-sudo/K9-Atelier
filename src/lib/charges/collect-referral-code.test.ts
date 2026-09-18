import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildPreviewCollectContext } from "@/lib/charges/preview";
import { shouldShowCollectReferralCode } from "@/lib/referrals/collect-code";
import { quoteReferralApplication } from "@/lib/referrals/eligible";

describe("collect checkout referral code field", () => {
  it("hides the referral code field after a household’s first paid visit", () => {
    const returning = buildPreviewCollectContext();
    assert.equal(returning.referral?.canEnterReferralCode, false);
    assert.equal(shouldShowCollectReferralCode(returning.referral), false);
  });

  it("shows the referral code field only on a new household’s first checkout", () => {
    const firstVisit = buildPreviewCollectContext({ firstVisit: true });
    assert.equal(firstVisit.referral?.canEnterReferralCode, true);
    assert.equal(shouldShowCollectReferralCode(firstVisit.referral), true);
    assert.equal(firstVisit.referral?.referralCode ?? null, null);
  });

  it("keeps new-client discount separate from referral credit on the bill", () => {
    const withDiscount = quoteReferralApplication({
      lineItems: [
        {
          id: "1",
          label: "Bath",
          amount: 140,
          referralCategory: "eligible_service",
        },
      ],
      tipAmount: 25.2,
      availableCreditCents: 10000,
      mode: "full",
      applyNewClientDiscount: true,
    });
    assert.equal(withDiscount.discountCents > 0, true);
    assert.equal(withDiscount.creditCents, 0);

    const withCredit = quoteReferralApplication({
      lineItems: [
        {
          id: "1",
          label: "Bath",
          amount: 140,
          referralCategory: "eligible_service",
        },
      ],
      tipAmount: 25.2,
      availableCreditCents: 10000,
      mode: "full",
      applyNewClientDiscount: false,
    });
    assert.equal(withCredit.discountCents, 0);
    assert.equal(withCredit.creditCents > 0, true);
  });
});

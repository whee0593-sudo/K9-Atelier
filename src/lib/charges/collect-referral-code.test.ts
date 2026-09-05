import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildPreviewCollectContext } from "@/lib/charges/preview";
import { quoteReferralApplication } from "@/lib/referrals/eligible";

describe("collect checkout referral code field", () => {
  it("exposes a referralCode slot on the preview collect context", () => {
    const context = buildPreviewCollectContext();
    assert.equal(context.referral?.referralCode ?? null, null);
    assert.equal(typeof context.referral?.availableCreditCents, "number");
    assert.equal(context.referral?.canUseCredit, true);
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

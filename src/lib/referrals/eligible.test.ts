import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  eligibleServiceCents,
  isEligibleReferralLine,
  newClientDiscountCents,
  quoteReferralApplication,
  resolveReferralCategory,
} from "./eligible";

describe("referral eligible amounts", () => {
  const bath = {
    id: "1",
    label: "Signature Bath & Care",
    amount: 90,
    catalogId: "signature-bath-care",
    referralCategory: "eligible_service" as const,
  };
  const travel = {
    id: "2",
    label: "Travel fee",
    amount: 26,
    catalogId: "travel-fee",
    referralCategory: "travel_fee" as const,
  };
  const handling = {
    id: "3",
    label: "Special handling fee",
    amount: 15,
    catalogId: "behavior-fee",
    referralCategory: "special_handling" as const,
  };
  const unmarked = {
    id: "4",
    label: "Additional care",
    amount: 40,
  };

  it("uses explicit categories, not label text", () => {
    assert.equal(isEligibleReferralLine(bath), true);
    assert.equal(isEligibleReferralLine(travel), false);
    assert.equal(isEligibleReferralLine(handling), false);
    assert.equal(resolveReferralCategory({}), "other_ineligible");
    assert.equal(isEligibleReferralLine({}), false);
    assert.equal(eligibleServiceCents([unmarked]), 0);
    assert.equal(
      isEligibleReferralLine({
        referralCategory: "eligible_service",
      }),
      true,
    );
  });

  it("calculates 10% of eligible services in cents", () => {
    assert.equal(eligibleServiceCents([bath, travel, handling, unmarked]), 9000);
    assert.equal(newClientDiscountCents(9000), 900);
    assert.equal(newClientDiscountCents(43000), 4300);
  });

  it("quotes credit after excluding fees and never exceeds eligible", () => {
    const quote = quoteReferralApplication({
      lineItems: [bath, travel],
      tipAmount: 40,
      availableCreditCents: 10000,
      mode: "full",
      applyNewClientDiscount: false,
    });
    assert.equal(quote.eligibleCents, 9000);
    assert.equal(quote.excludedCents, 2600);
    assert.equal(quote.tipCents, 4000);
    assert.equal(quote.creditCents, 9000);
    assert.equal(quote.dueCents, 6600);
  });

  it("does not combine referral credit with the new-client 10%", () => {
    const quote = quoteReferralApplication({
      lineItems: [bath],
      tipAmount: 0,
      availableCreditCents: 5000,
      mode: "full",
      applyNewClientDiscount: true,
    });
    assert.equal(quote.discountCents, 900);
    assert.equal(quote.creditCents, 0);
    assert.equal(quote.dueCents, 8100);
  });

  it("uses a custom amount capped by eligible and available", () => {
    const quote = quoteReferralApplication({
      lineItems: [bath],
      tipAmount: 0,
      availableCreditCents: 5000,
      mode: "custom",
      customDollars: 20,
      applyNewClientDiscount: false,
    });
    assert.equal(quote.creditCents, 2000);
    assert.equal(quote.dueCents, 7000);
  });
});

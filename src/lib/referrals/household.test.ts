import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyHouseholdMatch,
  reduceHouseholdEligibility,
} from "./household";

describe("referral household matching", () => {
  const current = {
    customerId: "new-1",
    email: "new@example.com",
    phone: "5615550100",
    stripeCustomerId: "cus_new",
  };

  it("puts the same full address on different accounts under review", () => {
    const result = classifyHouseholdMatch({
      current,
      currentAddresses: [{ street: "123 Example St Apt 4B", zip: "33401" }],
      other: {
        customerId: "old-1",
        email: "other@example.com",
        phone: "5615550199",
        stripeCustomerId: "cus_old",
      },
      otherAddresses: [{ street: "123 Example Street Apt 4B", zip: "33401" }],
      otherHasPaidService: true,
    });
    assert.equal(result.kind, "weak");
    assert.equal(result.reviewRequired, true);
    assert.equal(result.eligibleForNewClientDiscount, false);
  });

  it("rejects a duplicate account with the same phone", () => {
    const result = classifyHouseholdMatch({
      current,
      currentAddresses: [],
      other: {
        customerId: "old-2",
        email: "different@example.com",
        phone: "(561) 555-0100",
        stripeCustomerId: "cus_other",
      },
      otherAddresses: [],
      otherHasPaidService: true,
    });
    assert.equal(result.kind, "strong");
    assert.equal(result.eligibleForNewClientDiscount, false);
  });

  it("rejects a duplicate account with the same email", () => {
    const result = classifyHouseholdMatch({
      current,
      currentAddresses: [],
      other: {
        customerId: "old-3",
        email: "NEW@example.com",
        phone: "5615550188",
        stripeCustomerId: "cus_other",
      },
      otherAddresses: [],
      otherHasPaidService: true,
    });
    assert.equal(result.kind, "strong");
    assert.equal(result.eligibleForNewClientDiscount, false);
  });

  it("rejects a duplicate account with the same Stripe customer ID", () => {
    const result = classifyHouseholdMatch({
      current,
      currentAddresses: [],
      other: {
        customerId: "old-4",
        email: "else@example.com",
        phone: "5615550177",
        stripeCustomerId: "cus_new",
      },
      otherAddresses: [],
      otherHasPaidService: true,
    });
    assert.equal(result.kind, "strong");
    assert.equal(result.eligibleForNewClientDiscount, false);
  });

  it("keeps a strong paid match ahead of a weak address match", () => {
    const reduced = reduceHouseholdEligibility([
      {
        kind: "weak",
        reason: "full_address_match",
        eligibleForNewClientDiscount: false,
        reviewRequired: true,
      },
      {
        kind: "strong",
        reason: "strong_match_paid_history",
        eligibleForNewClientDiscount: false,
        reviewRequired: false,
      },
    ]);
    assert.equal(reduced.kind, "strong");
    assert.equal(reduced.reviewRequired, false);
  });
});

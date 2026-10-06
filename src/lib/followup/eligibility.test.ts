import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FOLLOW_UP_RETRY_DAYS,
  eligibleVisitPets,
  followUpServiceDateWindow,
  followUpVisitKey,
  isFollowUpSendHour,
  isFullyRefundedServiceVisit,
  isHouseholdFollowUpPetEligible,
  isNoShowAppointment,
  type FollowUpCharge,
  type FollowUpPet,
} from "./eligibility";

function pet(overrides: Partial<FollowUpPet> = {}): FollowUpPet {
  return {
    id: "daisy",
    customerId: "jane",
    petName: "Daisy",
    customerFirstName: "Jane",
    customerLastName: "Doe",
    customerEmail: "jane@example.com",
    customerPhone: "5615550100",
    appointmentDate: "2026-08-22",
    addressStreet: "10 Palm Street",
    addressCity: "Palm Beach Gardens",
    addressState: "FL",
    addressZip: "33418",
    status: "confirmed",
    serviceEndedAt: "2026-08-22T18:00:00.000Z",
    followupEmailSentAt: null,
    followupSmsSentAt: null,
    followupEmailClaimedAt: null,
    followupSmsClaimedAt: null,
    ...overrides,
  };
}

function charge(overrides: Partial<FollowUpCharge> = {}): FollowUpCharge {
  return {
    appointmentId: "daisy",
    kind: "service",
    status: "paid",
    total: 140,
    refundedAmount: 0,
    ...overrides,
  };
}

describe("follow-up eligibility", () => {
  const morning = new Date("2026-08-23T14:30:00.000Z");

  it("keeps a three-day retry window after 10:00 Eastern", () => {
    assert.equal(FOLLOW_UP_RETRY_DAYS, 3);
    assert.equal(isFollowUpSendHour(morning), true);
    assert.equal(
      isFollowUpSendHour(new Date("2026-08-23T13:30:00.000Z")),
      false,
    );
    assert.equal(
      isFollowUpSendHour(new Date("2026-08-23T15:30:00.000Z")),
      true,
    );
    assert.deepEqual(followUpServiceDateWindow(morning), {
      start: "2026-08-20",
      end: "2026-08-22",
    });
    assert.equal(
      followUpServiceDateWindow(new Date("2026-08-26T14:30:00.000Z")).start >
        "2026-08-22",
      true,
    );
  });

  it("groups the same customer, date, and service address as one visit", () => {
    const daisy = pet();
    const milo = pet({
      id: "milo",
      petName: "Milo",
      addressStreet: "10 Palm St.",
    });
    const otherVisit = pet({
      id: "otto",
      petName: "Otto",
      addressStreet: "88 Lake Drive",
    });
    assert.equal(followUpVisitKey(daisy), followUpVisitKey(milo));
    assert.notEqual(followUpVisitKey(daisy), followUpVisitKey(otherVisit));
  });

  it("drops cancelled, no-show, and fully refunded pets without dropping a completed sibling", () => {
    const completed = pet();
    const cancelled = pet({ id: "milo", petName: "Milo", status: "cancelled" });
    const noShow = pet({ id: "otto", petName: "Otto" });
    const refunded = pet({ id: "pip", petName: "Pip" });
    const charges = [
      charge(),
      charge({
        appointmentId: "otto",
        kind: "no_show",
        total: 70,
      }),
      charge({
        appointmentId: "pip",
        total: 140,
        refundedAmount: 140,
      }),
    ];
    assert.equal(isNoShowAppointment([charges[1]]), true);
    assert.equal(isFullyRefundedServiceVisit([charges[2]]), true);
    assert.equal(isHouseholdFollowUpPetEligible(completed, charges), true);
    assert.equal(isHouseholdFollowUpPetEligible(cancelled, charges), false);
    assert.equal(isHouseholdFollowUpPetEligible(noShow, charges), false);
    assert.equal(isHouseholdFollowUpPetEligible(refunded, charges), false);
    assert.deepEqual(
      eligibleVisitPets([completed, cancelled, noShow, refunded], charges).map(
        (row) => row.petName,
      ),
      ["Daisy"],
    );
  });

  it("still follows up after a partial refund", () => {
    const partial = charge({ refundedAmount: 20 });
    assert.equal(isFullyRefundedServiceVisit([partial]), false);
    assert.equal(isHouseholdFollowUpPetEligible(pet(), [partial]), true);
  });
});

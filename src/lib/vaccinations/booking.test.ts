import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  petHasConfirmedRabiesStatus,
  petProfileReadyToBook,
  vaccinationBookingNeedsAdminConfirmation,
  vaccinationHasUpload,
  vaccinationReadyToBook,
  vaccinationStatusSnapshotForBooking,
} from "@/lib/vaccinations/booking";

describe("vaccination booking helpers", () => {
  it("treats current, expiring_soon, and needs_review as legacy-ready", () => {
    assert.equal(vaccinationReadyToBook("current"), true);
    assert.equal(vaccinationReadyToBook("expiring_soon"), true);
    assert.equal(vaccinationReadyToBook("needs_review"), true);
    assert.equal(vaccinationReadyToBook("missing"), false);
  });

  it("does not require admin confirmation for rabies documents", () => {
    assert.equal(vaccinationBookingNeedsAdminConfirmation("needs_review"), false);
    assert.equal(vaccinationBookingNeedsAdminConfirmation("current"), false);
    assert.equal(vaccinationBookingNeedsAdminConfirmation("missing"), false);
  });

  it("detects uploads from summary flags", () => {
    assert.equal(
      vaccinationHasUpload({
        vaccinationHasUpload: true,
        vaccinationBookingStatus: "needs_review",
      }),
      true,
    );
    assert.equal(
      vaccinationHasUpload({
        vaccinationBookingStatus: "missing",
      }),
      false,
    );
  });

  it("treats confirmed rabies status as ready without a file", () => {
    assert.equal(
      petHasConfirmedRabiesStatus({ rabiesStatus: "current" }),
      true,
    );
    assert.equal(
      petHasConfirmedRabiesStatus({ rabiesStatus: "medical_exemption" }),
      true,
    );
    assert.equal(petHasConfirmedRabiesStatus({ rabiesStatus: null }), false);
  });

  it("keeps existing vaccination records bookable", () => {
    assert.equal(
      petHasConfirmedRabiesStatus({
        rabiesStatus: null,
        vaccinationHasUpload: true,
        vaccinationBookingStatus: "needs_review",
      }),
      true,
    );
  });

  it("treats name, breed, and weight as the only pet fields required to book", () => {
    assert.equal(
      petProfileReadyToBook({
        name: "Bella",
        breed: "Poodle",
        weightLbs: 12,
      }),
      true,
    );
    assert.equal(
      petProfileReadyToBook({
        name: "Bella",
        breed: "",
        weightLbs: 12,
      }),
      false,
    );
    assert.equal(
      petProfileReadyToBook({
        name: "Bella",
        breed: "Poodle",
        weightLbs: 0,
      }),
      false,
    );
  });

  it("snapshots booking vaccination status as current when rabies is confirmed without a file", () => {
    assert.equal(
      vaccinationStatusSnapshotForBooking({ rabiesStatus: "current" }),
      "current",
    );
    assert.equal(
      vaccinationStatusSnapshotForBooking({
        rabiesStatus: "medical_exemption",
        vaccinationBookingStatus: "needs_review",
      }),
      "needs_review",
    );
  });
});

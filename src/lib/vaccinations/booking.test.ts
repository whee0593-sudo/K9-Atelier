import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  petProfileReadyToBook,
  vaccinationBookingNeedsAdminConfirmation,
  vaccinationHasUpload,
  vaccinationReadyToBook,
} from "@/lib/vaccinations/booking";

describe("vaccination booking helpers", () => {
  it("treats current, expiring_soon, and needs_review as ready", () => {
    assert.equal(vaccinationReadyToBook("current"), true);
    assert.equal(vaccinationReadyToBook("expiring_soon"), true);
    assert.equal(vaccinationReadyToBook("needs_review"), true);
    assert.equal(vaccinationReadyToBook("missing"), false);
  });

  it("flags pending review for admin confirmation", () => {
    assert.equal(vaccinationBookingNeedsAdminConfirmation("needs_review"), true);
    assert.equal(vaccinationBookingNeedsAdminConfirmation("current"), false);
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

  it("maps profile booking readiness", () => {
    assert.equal(
      petProfileReadyToBook({ vaccinationBookingStatus: "current" } as never),
      true,
    );
    assert.equal(
      petProfileReadyToBook({
        vaccinationBookingStatus: "needs_review",
      } as never),
      true,
    );
    assert.equal(
      vaccinationBookingNeedsAdminConfirmation("needs_review"),
      true,
    );
  });
});

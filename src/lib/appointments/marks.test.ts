import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { appointmentCornerMark } from "@/lib/appointments/marks";

describe("appointment corner marks", () => {
  it("shows a red alert while vaccination is still blocking the booking", () => {
    assert.equal(
      appointmentCornerMark({
        status: "pending_confirmation",
        vaccinationStatusAtBooking: "needs_review",
      }),
      "vaccination_alert",
    );
    assert.equal(
      appointmentCornerMark({
        status: "cancelled",
        vaccinationStatusAtBooking: "needs_review",
      }),
      "vaccination_alert",
    );
  });

  it("hides the alert after staff books a vaccination-approved appointment", () => {
    assert.equal(
      appointmentCornerMark({
        status: "confirmed",
        vaccinationStatusAtBooking: "current",
        customerConfirmedAt: null,
      }),
      null,
    );
  });

  it("shows confirm only after the booking succeeded and the customer replies YES", () => {
    assert.equal(
      appointmentCornerMark({
        status: "confirmed",
        vaccinationStatusAtBooking: "current",
        customerConfirmedAt: "2026-07-05T13:00:00.000Z",
      }),
      "customer_yes",
    );
    assert.equal(
      appointmentCornerMark({
        status: "pending_confirmation",
        vaccinationStatusAtBooking: "needs_review",
        customerConfirmedAt: "2026-07-05T13:00:00.000Z",
      }),
      "vaccination_alert",
    );
  });
});

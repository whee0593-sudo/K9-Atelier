import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { appointmentCornerMark } from "@/lib/appointments/marks";

describe("appointment corner marks", () => {
  it("does not flag bookings when a rabies record was never uploaded", () => {
    assert.equal(
      appointmentCornerMark({
        status: "pending_confirmation",
        vaccinationStatusAtBooking: "needs_review",
      }),
      null,
    );
    assert.equal(
      appointmentCornerMark({
        status: "cancelled",
        vaccinationStatusAtBooking: "needs_review",
      }),
      null,
    );
    assert.equal(
      appointmentCornerMark({
        status: "confirmed",
        vaccinationStatusAtBooking: "missing",
      }),
      null,
    );
  });

  it("hides marks on a confirmed visit until the customer replies", () => {
    assert.equal(
      appointmentCornerMark({
        status: "confirmed",
        vaccinationStatusAtBooking: "current",
        customerConfirmedAt: null,
      }),
      null,
    );
  });

  it("hides the vaccination alert while a staff-created booking waits for the customer", () => {
    assert.equal(
      appointmentCornerMark({
        status: "pending_confirmation",
        vaccinationStatusAtBooking: "missing",
        awaitingCustomerConfirm: true,
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
      null,
    );
  });
});

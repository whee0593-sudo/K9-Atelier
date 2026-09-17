import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canStaffCancelAppointment,
  canStaffRescheduleAppointment,
} from "@/lib/appointments/staff-actions";

describe("staff calendar appointment actions", () => {
  it("lets staff cancel confirmed and pending bookings", () => {
    assert.equal(canStaffCancelAppointment({ status: "confirmed" }), true);
    assert.equal(
      canStaffCancelAppointment({ status: "pending_confirmation" }),
      true,
    );
    assert.equal(canStaffCancelAppointment({ status: "cancelled" }), false);
  });

  it("lets staff change date and time before the visit starts", () => {
    assert.equal(
      canStaffRescheduleAppointment({
        status: "confirmed",
        serviceStartedAt: null,
        serviceEndedAt: null,
      }),
      true,
    );
    assert.equal(
      canStaffRescheduleAppointment({
        status: "pending_confirmation",
        serviceStartedAt: null,
        serviceEndedAt: null,
      }),
      true,
    );
  });

  it("hides date changes after check-in or cancellation", () => {
    assert.equal(
      canStaffRescheduleAppointment({
        status: "confirmed",
        serviceStartedAt: "2026-09-24T15:00:00.000Z",
        serviceEndedAt: null,
      }),
      false,
    );
    assert.equal(
      canStaffRescheduleAppointment({
        status: "confirmed",
        serviceStartedAt: "2026-09-24T15:00:00.000Z",
        serviceEndedAt: "2026-09-24T16:00:00.000Z",
      }),
      false,
    );
    assert.equal(
      canStaffRescheduleAppointment({
        status: "cancelled",
        serviceStartedAt: null,
        serviceEndedAt: null,
      }),
      false,
    );
  });
});

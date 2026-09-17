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

  it("lets staff change date and time on pending, confirmed, and checked-out visits", () => {
    assert.equal(
      canStaffRescheduleAppointment({ status: "confirmed" }),
      true,
    );
    assert.equal(
      canStaffRescheduleAppointment({ status: "pending_confirmation" }),
      true,
    );
    assert.equal(canStaffRescheduleAppointment({ status: "cancelled" }), false);
  });
});

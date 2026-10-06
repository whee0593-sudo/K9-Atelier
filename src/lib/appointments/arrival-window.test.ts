import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ARRIVAL_WINDOW_PENDING_LABEL,
  displayAppointmentTime,
  resolveArrivalForBooking,
} from "@/lib/appointments/arrival-window";

describe("resolveArrivalForBooking", () => {
  it("keeps a window the scheduler already assigned", () => {
    const resolved = resolveArrivalForBooking(
      {
        insertion: {
          appointmentTime: "10:00–11:00 AM",
          scheduledStart: 600,
          usedPreference: "morning",
        },
      },
      540,
    );
    assert.equal("error" in resolved, false);
    if ("error" in resolved) return;
    assert.equal(resolved.appointmentTime, "10:00–11:00 AM");
    assert.equal(resolved.scheduledStart, 600);
  });

  it("still blocks a slot the availability system rejected", () => {
    const resolved = resolveArrivalForBooking(
      { error: "slot_unavailable" },
      600,
    );
    assert.deepEqual(resolved, { error: "slot_unavailable" });
  });

  it("continues with a null window when scheduling has not generated one", () => {
    const resolved = resolveArrivalForBooking(
      { error: "misconfigured" },
      540,
    );
    assert.equal("error" in resolved, false);
    if ("error" in resolved) return;
    assert.equal(resolved.appointmentTime, null);
    assert.equal(resolved.scheduledStart, 540);
    assert.equal(resolved.timePreference, "morning");
  });
});

describe("displayAppointmentTime", () => {
  it("labels a missing window without treating it as an error", () => {
    assert.equal(displayAppointmentTime(null), ARRIVAL_WINDOW_PENDING_LABEL);
    assert.equal(displayAppointmentTime("  "), ARRIVAL_WINDOW_PENDING_LABEL);
    assert.equal(displayAppointmentTime("9:00–10:00 AM"), "9:00–10:00 AM");
  });
});

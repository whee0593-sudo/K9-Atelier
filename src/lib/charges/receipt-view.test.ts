import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatReceiptServiceTime } from "./receipt-view";

describe("receipt service time", () => {
  it("uses check-in and check-out clock times", () => {
    assert.equal(
      formatReceiptServiceTime({
        appointmentTime: "09:00",
        timezone: "America/New_York",
        serviceStartedAt: "2026-07-08T13:12:00.000Z",
        serviceEndedAt: "2026-07-08T15:03:00.000Z",
      }),
      "9:12 AM–11:03 AM",
    );
  });

  it("falls back to the booked window when the visit was not timed", () => {
    assert.equal(
      formatReceiptServiceTime({
        appointmentTime: "10:00–12:00 PM",
        timezone: "America/New_York",
        serviceStartedAt: null,
        serviceEndedAt: null,
      }),
      "10:00 AM–12:00 PM",
    );
  });
});

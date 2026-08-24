import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatAppointmentTimeRange } from "./time-label";

describe("appointment time labels", () => {
  it("gives each side of a window its own AM or PM", () => {
    assert.equal(formatAppointmentTimeRange("10:00–12:00 PM"), "10:00 AM–12:00 PM");
    assert.equal(formatAppointmentTimeRange("1:00–3:00 PM"), "1:00 PM–3:00 PM");
    assert.equal(formatAppointmentTimeRange("9:00–10:30 AM"), "9:00 AM–10:30 AM");
  });

  it("keeps AM/PM when the window crosses noon or midnight", () => {
    assert.equal(formatAppointmentTimeRange("11:00–1:00 PM"), "11:00 AM–1:00 PM");
    assert.equal(formatAppointmentTimeRange("11:00–1:00 AM"), "11:00 PM–1:00 AM");
    assert.equal(
      formatAppointmentTimeRange("11:00 AM–1:00 PM"),
      "11:00 AM–1:00 PM",
    );
    assert.equal(
      formatAppointmentTimeRange("11:00 PM–1:00 AM"),
      "11:00 PM–1:00 AM",
    );
  });

  it("formats a 24-hour clock time without inventing a range", () => {
    assert.equal(formatAppointmentTimeRange("09:00"), "9:00 AM");
    assert.equal(formatAppointmentTimeRange("14:00"), "2:00 PM");
  });

  it("returns null for a blank time", () => {
    assert.equal(formatAppointmentTimeRange("   "), null);
    assert.equal(formatAppointmentTimeRange(undefined), null);
  });
});

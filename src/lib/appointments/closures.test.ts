import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyClosureToAvailability,
  closureMode,
  closureShortLabel,
  isPreferenceClosed,
  normalizeDayClosure,
} from "@/lib/appointments/closures";

describe("normalizeDayClosure", () => {
  it("returns null when the day stays open", () => {
    assert.equal(normalizeDayClosure({}), null);
    assert.equal(
      normalizeDayClosure({
        closedAllDay: false,
        closedMorning: false,
        closedAfternoon: false,
      }),
      null,
    );
  });

  it("expands a full-day close across both halves", () => {
    assert.deepEqual(normalizeDayClosure({ closedAllDay: true }), {
      closedAllDay: true,
      closedMorning: true,
      closedAfternoon: true,
    });
  });

  it("promotes both halves to a full-day close", () => {
    assert.deepEqual(
      normalizeDayClosure({ closedMorning: true, closedAfternoon: true }),
      {
        closedAllDay: true,
        closedMorning: true,
        closedAfternoon: true,
      },
    );
  });

  it("keeps a single half-day close", () => {
    assert.deepEqual(normalizeDayClosure({ closedMorning: true }), {
      closedAllDay: false,
      closedMorning: true,
      closedAfternoon: false,
    });
  });
});

describe("applyClosureToAvailability", () => {
  const open = { available: true, morning: true, afternoon: true };

  it("leaves flags unchanged when there is no closure", () => {
    assert.deepEqual(applyClosureToAvailability(open, null), open);
  });

  it("blocks the whole day when closedAllDay is set", () => {
    assert.deepEqual(
      applyClosureToAvailability(open, {
        serviceDate: "2026-10-01",
        closedAllDay: true,
        closedMorning: true,
        closedAfternoon: true,
      }),
      { available: false, morning: false, afternoon: false },
    );
  });

  it("blocks only the closed half-day", () => {
    assert.deepEqual(
      applyClosureToAvailability(open, {
        serviceDate: "2026-10-01",
        closedAllDay: false,
        closedMorning: true,
        closedAfternoon: false,
      }),
      { available: true, morning: false, afternoon: true },
    );
  });
});

describe("isPreferenceClosed", () => {
  it("rejects morning bookings on a morning closure", () => {
    const closure = {
      serviceDate: "2026-10-01",
      closedAllDay: false,
      closedMorning: true,
      closedAfternoon: false,
    };
    assert.equal(isPreferenceClosed(closure, "morning"), true);
    assert.equal(isPreferenceClosed(closure, "afternoon"), false);
  });

  it("rejects any preference on a full-day closure", () => {
    const closure = {
      serviceDate: "2026-10-01",
      closedAllDay: true,
      closedMorning: true,
      closedAfternoon: true,
    };
    assert.equal(isPreferenceClosed(closure, "morning"), true);
    assert.equal(isPreferenceClosed(closure, "afternoon"), true);
  });
});

describe("closure labels", () => {
  it("maps modes and short labels for the admin calendar", () => {
    assert.equal(closureMode(null), "open");
    assert.equal(closureShortLabel(null), null);
    assert.equal(
      closureMode({
        serviceDate: "2026-10-01",
        closedAllDay: true,
        closedMorning: true,
        closedAfternoon: true,
      }),
      "day",
    );
    assert.equal(
      closureShortLabel({
        serviceDate: "2026-10-01",
        closedAllDay: false,
        closedMorning: true,
        closedAfternoon: false,
      }),
      "AM closed",
    );
    assert.equal(
      closureShortLabel({
        serviceDate: "2026-10-01",
        closedAllDay: false,
        closedMorning: false,
        closedAfternoon: true,
      }),
      "PM closed",
    );
  });
});

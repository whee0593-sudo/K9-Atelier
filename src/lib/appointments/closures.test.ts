import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyClosureToSlots,
  closureShortLabel,
  isSlotClosed,
  normalizeDayClosure,
} from "@/lib/appointments/closures";

describe("normalizeDayClosure", () => {
  it("returns null when the day stays open", () => {
    assert.equal(normalizeDayClosure({}), null);
    assert.equal(
      normalizeDayClosure({
        closedAllDay: false,
        closedHours: [],
      }),
      null,
    );
  });

  it("expands a full-day close across every start hour", () => {
    const normalized = normalizeDayClosure({ closedAllDay: true });
    assert.equal(normalized?.closedAllDay, true);
    assert.ok((normalized?.closedHours.length ?? 0) >= 7);
  });

  it("keeps selected hours only", () => {
    assert.deepEqual(normalizeDayClosure({ closedHours: [9, 11] }), {
      closedAllDay: false,
      closedHours: [9, 11],
    });
  });
});

describe("applyClosureToSlots", () => {
  const slots = [9 * 60, 10 * 60, 11 * 60, 13 * 60];

  it("leaves slots unchanged when there is no closure", () => {
    assert.deepEqual(applyClosureToSlots(slots, null), {
      available: true,
      slots,
    });
  });

  it("blocks the whole day when closedAllDay is set", () => {
    assert.deepEqual(
      applyClosureToSlots(slots, {
        serviceDate: "2026-10-01",
        closedAllDay: true,
        closedHours: [9, 10, 11, 12, 13, 14, 15],
      }),
      { available: false, slots: [] },
    );
  });

  it("blocks only closed hours", () => {
    assert.deepEqual(
      applyClosureToSlots(slots, {
        serviceDate: "2026-10-01",
        closedAllDay: false,
        closedHours: [9, 11],
      }),
      { available: true, slots: [10 * 60, 13 * 60] },
    );
  });
});

describe("isSlotClosed", () => {
  it("rejects a closed hour start", () => {
    const closure = {
      serviceDate: "2026-10-01",
      closedAllDay: false,
      closedHours: [10],
    };
    assert.equal(isSlotClosed(closure, 10 * 60), true);
    assert.equal(isSlotClosed(closure, 11 * 60), false);
  });
});

describe("closure labels", () => {
  it("maps short labels for the admin calendar", () => {
    assert.equal(closureShortLabel(null), null);
    assert.equal(
      closureShortLabel({
        serviceDate: "2026-10-01",
        closedAllDay: true,
        closedHours: [9, 10, 11, 12, 13, 14, 15],
      }),
      "Closed",
    );
    assert.equal(
      closureShortLabel({
        serviceDate: "2026-10-01",
        closedAllDay: false,
        closedHours: [9],
      }),
      "9:00 AM closed",
    );
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  describeStaffScheduleConflict,
  listStaffOverrideHourStarts,
} from "@/lib/staff/schedule-conflict";

const base = { lat: 26.845, lon: -80.107 };
const nearby = { lat: 26.85, lon: -80.1 };

describe("describeStaffScheduleConflict", () => {
  const afternoonVisit = {
    lat: nearby.lat,
    lon: nearby.lon,
    scheduledStart: 13 * 60,
    durationMinutes: 90,
  };

  it("warns when two dogs and three services cannot finish before a 1:00 PM visit", () => {
    const message = describeStaffScheduleConflict({
      startMinutes: 9 * 60,
      durations: [113, 98, 83],
      stops: [afternoonVisit],
    });
    assert.ok(message);
    assert.match(message, /9:00 AM/);
    assert.match(message, /1:00 PM/);
    assert.match(message, /15-minute gap/);
    assert.match(message, /overlaps a visit already scheduled at 1:00 PM/);
  });

  it("warns when the estimate misses the 15-minute gap by one minute", () => {
    const message = describeStaffScheduleConflict({
      startMinutes: 9 * 60,
      durations: [226],
      stops: [afternoonVisit],
    });
    assert.equal(
      message,
      "These services are estimated at 3 hr 46 min, from 9:00 AM to 12:46 PM. A visit is already scheduled at 1:00 PM. The route keeps a 15-minute gap between stops, and this estimate leaves 14 minutes.",
    );
  });

  it("allows a morning chain that finishes 15 minutes before the next visit", () => {
    assert.equal(
      describeStaffScheduleConflict({
        startMinutes: 9 * 60,
        durations: [225],
        stops: [afternoonVisit],
      }),
      null,
    );
  });

  it("warns when the chain runs past closing", () => {
    const message = describeStaffScheduleConflict({
      startMinutes: 15 * 60,
      durations: [120, 120],
      stops: [],
    });
    assert.ok(message);
    assert.match(message, /from 3:00 PM to 7:00 PM/);
    assert.match(message, /Studio hours end at 5:00 PM/);
  });
});

describe("listStaffOverrideHourStarts", () => {
  it("keeps 9:00 AM selectable when the estimated chain overlaps a 1:00 PM visit", () => {
    const result = listStaffOverrideHourStarts({
      base,
      incoming: nearby,
      stops: [
        {
          lat: nearby.lat,
          lon: nearby.lon,
          scheduledStart: 13 * 60,
          durationMinutes: 90,
        },
      ],
      durations: [113, 98, 83],
    });
    assert.ok(result.slots.includes(9 * 60));
    assert.match(result.conflicts[String(9 * 60)] ?? "", /1:00 PM/);
  });
});

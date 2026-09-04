import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  addressAllowedForPlan,
  findRouteInsertion,
  findRouteInsertionAtHour,
  formatArrivalWindow,
  haversineMiles,
  inferZoneIdFromZip,
  listAvailableHourStarts,
  preferenceAvailability,
} from "@/lib/booking-schedule";

const base = { lat: 26.845, lon: -80.107 };
const jupiter = { lat: 26.934, lon: -80.094 };
const westPalm = { lat: 26.715, lon: -80.053 };

describe("booking schedule", () => {
  it("maps Jupiter and West Palm Beach zips to zones", () => {
    assert.equal(inferZoneIdFromZip("33458"), "jupiter");
    assert.equal(inferZoneIdFromZip("33401-1234"), "west-palm-beach");
    assert.equal(inferZoneIdFromZip("99999"), null);
  });

  it("assigns the first stop of an empty day at opening time", () => {
    const result = findRouteInsertion(base, [], jupiter, 90, "morning");
    assert.ok(result);
    assert.equal(result.scheduledStart, 9 * 60);
    assert.equal(result.usedPreference, "morning");
    assert.equal(result.appointmentTime, "9:00–10:30 AM");
  });

  it("falls back to afternoon when morning is full", () => {
    const stops = [
      {
        lat: jupiter.lat,
        lon: jupiter.lon,
        scheduledStart: 9 * 60,
        durationMinutes: 180,
      },
    ];
    const result = findRouteInsertion(base, stops, jupiter, 90, "morning");
    assert.ok(result);
    assert.equal(result.usedPreference, "afternoon");
    assert.ok(result.scheduledStart >= 12 * 60);
  });

  it("rejects a fifth appointment", () => {
    const stops = [0, 1, 2, 3].map((index) => ({
      lat: jupiter.lat,
      lon: jupiter.lon,
      scheduledStart: 9 * 60 + index * 90,
      durationMinutes: 60,
    }));
    const result = findRouteInsertion(base, stops, jupiter, 60, "afternoon");
    assert.equal(result, null);
  });

  it("keeps a far address off a locked Jupiter day", () => {
    const allowed = addressAllowedForPlan(
      {
        serviceDate: "2026-09-21",
        zoneId: "jupiter",
        source: "staff",
        anchor: null,
      },
      "33401",
      westPalm,
    );
    assert.equal(allowed, false);
  });

  it("lists on-the-hour starts and places an exact hour booking", () => {
    const slots = listAvailableHourStarts(base, [], jupiter, 65);
    assert.ok(slots.includes(9 * 60));
    assert.equal(slots.includes(15 * 60), false);

    const first = findRouteInsertionAtHour(base, [], jupiter, 65, 9 * 60);
    assert.ok(first);
    assert.equal(first.scheduledStart, 9 * 60);

    const afterFirst = listAvailableHourStarts(
      base,
      [
        {
          lat: jupiter.lat,
          lon: jupiter.lon,
          scheduledStart: 9 * 60,
          durationMinutes: 65,
        },
      ],
      jupiter,
      65,
    );
    assert.equal(afterFirst.includes(9 * 60), false);
    assert.equal(afterFirst.includes(10 * 60), false);
    assert.ok(afterFirst.includes(11 * 60));
  });

  it("reports morning and afternoon independently", () => {
    const flags = preferenceAvailability(base, [], jupiter, 90);
    assert.equal(flags.morning, true);
    assert.equal(flags.afternoon, true);
  });

  it("measures Palm Beach Gardens to Jupiter as under the cluster radius", () => {
    assert.ok(haversineMiles(base, jupiter) < 8);
    assert.ok(haversineMiles(jupiter, westPalm) > 8);
  });

  it("formats mixed AM/PM windows", () => {
    assert.equal(formatArrivalWindow(11 * 60 + 30, 90), "11:30 AM – 1:00 PM");
  });
});

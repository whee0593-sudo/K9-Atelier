import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  OCCUPANCY_ANOMALY_MESSAGE,
  resolveOccupiedStop,
  type OccupiedSourceRow,
} from "@/lib/appointments/occupied-stop";
import { findRouteInsertionAtHour, getDayBounds } from "@/lib/booking-schedule";
import { estimateServiceDurationMinutes } from "@/lib/services";
import { zonedDateTimeToUtc } from "@/lib/sms/schedule";
import { visitArrivalFits } from "@/lib/visits/visit";

const BATH = "signature-bath-care";
const BASE = { lat: 26.8, lon: -80.05 };
const INCOMING = { lat: 26.81, lon: -80.06 };
const ONE_PM = 13 * 60;

function row(overrides: Partial<OccupiedSourceRow> = {}): OccupiedSourceRow {
  return {
    id: "appt-1",
    appointment_date: "2026-11-02",
    address_lat: 26.8,
    address_lon: -80.05,
    scheduled_start: ONE_PM,
    service_id: BATH,
    add_on_ids: [],
    address_zip: "33401",
    estimated_duration_minutes: null,
    pets: { weight_lbs: null },
    visit_id: null,
    service_started_at: null,
    service_ended_at: null,
    ...overrides,
  };
}

function captureErrors(run: () => void) {
  const messages: unknown[][] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => {
    messages.push(args);
  };
  try {
    run();
    return messages;
  } finally {
    console.error = original;
  }
}

function sameStartIsClosed(stop: { scheduledStart: number; durationMinutes: number }) {
  assert.equal(
    visitArrivalFits({
      visitStartMinutes: stop.scheduledStart,
      durations: [60],
      otherStops: [stop],
    }),
    false,
  );
  assert.equal(
    findRouteInsertionAtHour(BASE, [stop], INCOMING, 60, stop.scheduledStart),
    null,
  );
}

describe("occupied appointment without a saved duration", () => {
  it("keeps a saved duration and leaves the later hour bookable", () => {
    const source = row({
      estimated_duration_minutes: 90,
      pets: { weight_lbs: null },
    });
    const errors = captureErrors(() => {
      const decision = resolveOccupiedStop(source);
      assert.equal(decision.anomaly, false);
      assert.equal(decision.stop.durationMinutes, 90);
      assert.equal(decision.stop.scheduledStart, ONE_PM);
      sameStartIsClosed(decision.stop);
      assert.equal(
        visitArrivalFits({
          visitStartMinutes: 15 * 60,
          durations: [60],
          otherStops: [decision.stop],
        }),
        true,
      );
    });
    assert.equal(errors.length, 0);
    assert.equal(source.estimated_duration_minutes, 90);
  });

  it("uses the real weight tier and does not substitute 20 lbs", () => {
    const at12 = estimateServiceDurationMinutes(BATH, 12, []);
    const at20 = estimateServiceDurationMinutes(BATH, 20, []);
    assert.notEqual(at12, at20);
    const decision = resolveOccupiedStop(row({ pets: { weight_lbs: 12 } }));
    assert.equal(decision.anomaly, false);
    assert.equal(decision.stop.durationMinutes, at12);
    assert.notEqual(decision.stop.durationMinutes, at20);
    sameStartIsClosed(decision.stop);
    assert.equal(
      visitArrivalFits({
        visitStartMinutes: 15 * 60,
        durations: [60],
        otherStops: [decision.stop],
      }),
      true,
    );
  });

  it("restores the block from a recorded service interval", () => {
    const decision = resolveOccupiedStop(
      row({
        service_started_at: "2026-11-02T17:00:00.000Z",
        service_ended_at: "2026-11-02T18:15:00.000Z",
      }),
    );
    assert.equal(decision.anomaly, false);
    assert.equal(decision.stop.durationMinutes, 75);
    assert.notEqual(
      decision.stop.durationMinutes,
      estimateServiceDurationMinutes(BATH, 20, []),
    );
    sameStartIsClosed(decision.stop);
  });

  it("restores the block from the next saved start on the same visit", () => {
    const current = row({ id: "appt-1", visit_id: "visit-1" });
    const next = row({
      id: "appt-2",
      visit_id: "visit-1",
      scheduled_start: ONE_PM + 80,
    });
    const decision = resolveOccupiedStop(current, [current, next]);
    assert.equal(decision.anomaly, false);
    assert.equal(decision.stop.durationMinutes, 80);
    assert.equal(current.estimated_duration_minutes, null);
    sameStartIsClosed(decision.stop);
  });

  it("blocks the unresolved remainder of the day instead of reopening the start", () => {
    const source = row();
    const { hoursEnd } = getDayBounds();
    let decision: ReturnType<typeof resolveOccupiedStop> | null = null;
    const errors = captureErrors(() => {
      decision = resolveOccupiedStop(source);
    });
    assert.ok(decision);
    assert.equal(decision.anomaly, true);
    assert.equal(decision.stop.scheduledStart, ONE_PM);
    assert.equal(decision.stop.durationMinutes, hoursEnd - ONE_PM);
    assert.notEqual(
      decision.stop.durationMinutes,
      estimateServiceDurationMinutes(BATH, 20, []),
    );
    assert.notEqual(
      decision.stop.durationMinutes,
      estimateServiceDurationMinutes(BATH, 12, []),
    );
    assert.equal(source.estimated_duration_minutes, null);
    sameStartIsClosed(decision.stop);
    assert.equal(
      findRouteInsertionAtHour(BASE, [decision.stop], INCOMING, 60, 15 * 60),
      null,
    );
    assert.equal(
      visitArrivalFits({
        visitStartMinutes: 9 * 60,
        durations: [60],
        otherStops: [decision.stop],
      }),
      true,
    );
    assert.equal(errors.length, 1);
    assert.equal(errors[0]?.[0], OCCUPANCY_ANOMALY_MESSAGE);
    assert.equal(
      (errors[0]?.[1] as { appointmentId?: string }).appointmentId,
      "appt-1",
    );
  });

  it("rejects an unusable weight the same way as a missing weight", () => {
    const { hoursEnd } = getDayBounds();
    for (const weight of [0, -3, Number.NaN, 201, 250]) {
      const errors = captureErrors(() => {
        const decision = resolveOccupiedStop(row({ pets: { weight_lbs: weight } }));
        assert.equal(decision.anomaly, true);
        assert.equal(decision.stop.durationMinutes, hoursEnd - ONE_PM);
        sameStartIsClosed(decision.stop);
      });
      assert.equal(errors.length, 1);
    }
  });

  it("uses the recorded clock when the scheduled start is missing", () => {
    const started = zonedDateTimeToUtc("2026-11-02", "10:30:00");
    const ended = zonedDateTimeToUtc("2026-11-02", "11:45:00");
    const decision = resolveOccupiedStop(
      row({
        scheduled_start: null,
        service_started_at: started.toISOString(),
        service_ended_at: ended.toISOString(),
      }),
    );
    assert.equal(decision.anomaly, false);
    assert.equal(decision.stop.scheduledStart, 10 * 60 + 30);
    assert.equal(decision.stop.durationMinutes, 75);
    sameStartIsClosed(decision.stop);
    assert.equal(
      visitArrivalFits({
        visitStartMinutes: 9 * 60,
        durations: [60],
        otherStops: [decision.stop],
      }),
      true,
    );
  });
});

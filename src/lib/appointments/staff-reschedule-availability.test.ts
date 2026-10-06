import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  appointmentOverlapsBlocks,
  type AvailabilityBlock,
} from "@/lib/appointments/availability-blocks";
import { isOperationalAdminAppointment } from "@/lib/appointments/operational-visibility";
import { findRouteInsertionAtHour } from "@/lib/booking-schedule";

const base = { lat: 26.845, lon: -80.107 };
const jupiter = { lat: 26.934, lon: -80.094 };

const middayBlock: AvailabilityBlock = {
  id: "block-midday",
  serviceDate: "2026-10-12",
  allDay: false,
  startMinutes: 12 * 60,
  endMinutes: 14 * 60,
  reason: "Personal",
};

describe("staff reschedule availability", () => {
  it("accepts a free arrival window", () => {
    const placed = findRouteInsertionAtHour(base, [], jupiter, 90, 9 * 60);
    assert.ok(placed);
    assert.equal(placed.scheduledStart, 9 * 60);
    assert.equal(
      appointmentOverlapsBlocks([middayBlock], 9 * 60, 60),
      false,
    );
  });

  it("rejects a window that overlaps an availability block", () => {
    assert.equal(appointmentOverlapsBlocks([middayBlock], 12 * 60, 90), true);
    const allDay = {
      ...middayBlock,
      allDay: true,
      startMinutes: null,
      endMinutes: null,
    };
    assert.equal(appointmentOverlapsBlocks([allDay], 9 * 60, 90), true);
    assert.equal(appointmentOverlapsBlocks([allDay], 14 * 60, 90), true);
  });

  it("rejects a window that overlaps another appointment", () => {
    const conflict = findRouteInsertionAtHour(
      base,
      [
        {
          lat: jupiter.lat,
          lon: jupiter.lon,
          scheduledStart: 9 * 60,
          durationMinutes: 90,
        },
      ],
      jupiter,
      90,
      9 * 60,
    );
    assert.equal(conflict, null);
  });

  it("rejects a window the service duration cannot fit", () => {
    const tooLate = findRouteInsertionAtHour(base, [], jupiter, 120, 16 * 60);
    assert.equal(tooLate, null);
  });

  it("frees a window once the occupying appointment is no longer active", () => {
    const occupied = findRouteInsertionAtHour(
      base,
      [
        {
          lat: jupiter.lat,
          lon: jupiter.lon,
          scheduledStart: 11 * 60,
          durationMinutes: 60,
        },
      ],
      jupiter,
      60,
      11 * 60,
    );
    assert.equal(occupied, null);
    const remaining = [
      { status: "confirmed" as const },
      { status: "cancelled" as const },
    ].filter((row) => isOperationalAdminAppointment(row.status));
    assert.equal(remaining.length, 1);
    const freed = findRouteInsertionAtHour(base, [], jupiter, 60, 11 * 60);
    assert.ok(freed);
    assert.equal(freed.scheduledStart, 11 * 60);
  });
});

describe("staff reschedule and cancel server gates", () => {
  it("rechecks availability inside the staff reschedule service", () => {
    const reschedule = readFileSync(
      new URL("./staff-reschedule.ts", import.meta.url),
      "utf8",
    );
    const schedule = readFileSync(new URL("./schedule.ts", import.meta.url), "utf8");
    assert.match(reschedule, /getStaffSession/);
    assert.match(reschedule, /assignArrivalWindow/);
    assert.match(reschedule, /excludeAppointmentIds: \[appointmentId\]/);
    assert.equal(
      reschedule.includes("excludeAppointmentIds: rows") ||
        reschedule.includes("excludeAppointmentIds: [loaded"),
      false,
    );
    const rescheduleBodyEarly = reschedule.slice(
      reschedule.indexOf("export async function rescheduleStaffAppointment"),
    );
    const checkAt = rescheduleBodyEarly.indexOf("await assignArrivalWindow");
    const emailSkip = rescheduleBodyEarly.indexOf("notifyCustomerAppointmentChange");
    assert.ok(checkAt > 0);
    assert.ok(emailSkip > checkAt);
    assert.match(schedule, /appointmentOverlapsBlocks/);
    assert.match(schedule, /function assignArrivalWindow/);
    assert.match(schedule, /\.neq\("status", "cancelled"\)/);
    const availability = schedule.slice(
      schedule.indexOf("export async function getAvailabilityForAddress"),
      schedule.indexOf("export async function assignArrivalWindow"),
    );
    assert.match(availability, /block\.allDay/);
    const assign = schedule.slice(
      schedule.indexOf("export async function assignArrivalWindow"),
    );
    const blockCheck = assign.indexOf("appointmentOverlapsBlocks");
    const exclude = assign.indexOf("excludeAppointmentIds: input.excludeAppointmentIds");
    assert.ok(blockCheck > 0);
    assert.ok(exclude > blockCheck);
    assert.doesNotMatch(reschedule, /admin_availability_blocks/);
    assert.doesNotMatch(reschedule, /deleteAvailabilityBlock/);
    const rescheduleBody = reschedule.slice(
      reschedule.indexOf("export async function rescheduleStaffAppointment"),
    );
    const availabilityCall = rescheduleBody.indexOf("await assignArrivalWindow");
    assert.ok(availabilityCall > 0);
    assert.doesNotMatch(
      rescheduleBody.slice(0, availabilityCall),
      /appointment_date\s*===/,
    );
    assert.match(reschedule, /excludeAppointmentIds: \[appointmentId\]/);
    assert.doesNotMatch(reschedule, /excludeAppointmentIds: blocks/);
  });

  it("rejects a same-day move onto an all-day block without ignoring availability rules", () => {
    const allDay = {
      ...middayBlock,
      serviceDate: "2026-10-20",
      allDay: true,
      startMinutes: null,
      endMinutes: null,
    };
    const movingId = "bella";
    const otherAppointments = [
      { id: movingId, start: 9 * 60 },
      { id: "milo", start: 13 * 60 + 30 },
    ].filter((row) => row.id !== movingId);
    assert.equal(otherAppointments.length, 1);
    assert.equal(appointmentOverlapsBlocks([allDay], 9 * 60, 90), true);
    assert.equal(appointmentOverlapsBlocks([allDay], 14 * 60, 90), true);
    assert.equal(appointmentOverlapsBlocks([], 10 * 60, 90), false);
  });

  it("cancels through staff status and leaves cancelled rows out of booked counts", () => {
    const service = readFileSync(new URL("./service.ts", import.meta.url), "utf8");
    const calendar = readFileSync(new URL("./calendar.ts", import.meta.url), "utf8");
    assert.match(service, /getStaffSession/);
    assert.match(service, /staff_set_appointment_status/);
    assert.match(service, /\.neq\("status", "cancelled"\)/);
    assert.match(calendar, /\.neq\("status", "cancelled"\)/);
    assert.doesNotMatch(service, /admin_availability_blocks/);
    assert.doesNotMatch(service, /deleteAvailabilityBlock/);
  });
});

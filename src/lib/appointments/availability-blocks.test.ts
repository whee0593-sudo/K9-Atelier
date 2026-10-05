import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyBlocksToSlots,
  appointmentOverlapsBlocks,
  availabilityBlockConflictMessage,
  availabilityBlockLabel,
  buildDayTimeline,
  listBlockTimeOptions,
  normalizeAvailabilityBlockInput,
  staffAvailabilityAccessStatus,
  type AvailabilityBlock,
} from "@/lib/appointments/availability-blocks";

const hourly = [9, 10, 11, 12, 13, 14, 15, 16].map((hour) => hour * 60);

function block(
  patch: Partial<AvailabilityBlock> & Pick<AvailabilityBlock, "id">,
): AvailabilityBlock {
  return {
    serviceDate: "2026-10-12",
    allDay: false,
    startMinutes: 10 * 60,
    endMinutes: 14 * 60,
    reason: null,
    ...patch,
  };
}

describe("availability block labels", () => {
  it("shows one partial block as a short range", () => {
    assert.equal(
      availabilityBlockLabel([block({ id: "a" })]),
      "Blocked 10–2",
    );
  });

  it("counts several blocks instead of listing every range", () => {
    assert.equal(
      availabilityBlockLabel([
        block({ id: "a", endMinutes: 12 * 60 }),
        block({ id: "b", startMinutes: 13 * 60, endMinutes: 15 * 60 }),
      ]),
      "2 blocks",
    );
  });

  it("marks an all-day block unavailable", () => {
    assert.equal(
      availabilityBlockLabel([
        block({
          id: "day",
          allDay: true,
          startMinutes: null,
          endMinutes: null,
        }),
      ]),
      "Unavailable",
    );
  });
});

describe("applyBlocksToSlots", () => {
  const midday = block({
    id: "mid",
    startMinutes: 12 * 60,
    endMinutes: 15 * 60,
  });

  it("removes arrival windows that overlap a blocked range", () => {
    const gated = applyBlocksToSlots(hourly, [midday], 60);
    assert.deepEqual(gated.slots, [9, 10, 11, 15, 16].map((hour) => hour * 60));
    assert.equal(gated.available, true);
  });

  it("also removes an earlier start whose service runs into the block", () => {
    const gated = applyBlocksToSlots(hourly, [midday], 90);
    assert.equal(gated.slots.includes(11 * 60), false);
    assert.equal(gated.slots.includes(10 * 60), true);
    assert.equal(gated.slots.includes(15 * 60), true);
  });

  it("closes the whole day for an all-day block", () => {
    const gated = applyBlocksToSlots(
      hourly,
      [
        block({
          id: "day",
          allDay: true,
          startMinutes: null,
          endMinutes: null,
        }),
      ],
      60,
    );
    assert.deepEqual(gated, { available: false, slots: [] });
  });

  it("restores the original windows after the block is removed", () => {
    const blocked = applyBlocksToSlots(hourly, [midday], 60);
    const restored = applyBlocksToSlots(hourly, [], 60);
    assert.notDeepEqual(blocked.slots, hourly);
    assert.deepEqual(restored.slots, hourly);
    assert.equal(
      appointmentOverlapsBlocks([], 12 * 60, 60),
      false,
    );
  });
});

describe("availability block writes", () => {
  it("rejects an end time that is not after the start", () => {
    const result = normalizeAvailabilityBlockInput({
      serviceDate: "2026-10-12",
      startMinutes: 14 * 60,
      endMinutes: 10 * 60,
    });
    assert.equal(result.ok, false);
  });

  it("rejects a second all-day block and an overlapping range", () => {
    const allDay = block({
      id: "day",
      allDay: true,
      startMinutes: null,
      endMinutes: null,
    });
    assert.equal(
      availabilityBlockConflictMessage(
        [allDay],
        {
          serviceDate: "2026-10-12",
          allDay: true,
          startMinutes: null,
          endMinutes: null,
          reason: null,
        },
      ),
      "This day is already unavailable.",
    );
    assert.equal(
      availabilityBlockConflictMessage(
        [block({ id: "a" })],
        {
          serviceDate: "2026-10-12",
          allDay: false,
          startMinutes: 13 * 60,
          endMinutes: 15 * 60,
          reason: "Personal",
        },
      ),
      "That time overlaps another blocked period.",
    );
  });

  it("offers quarter hours inside studio hours", () => {
    const options = listBlockTimeOptions();
    assert.equal(options[0], 9 * 60);
    assert.equal(options.at(-1), 17 * 60);
    assert.equal(options.includes(10 * 60), true);
    assert.equal(options.includes(14 * 60), true);
  });
});

describe("day timeline", () => {
  it("orders appointments and blocked time together", () => {
    const timeline = buildDayTimeline({
      appointments: [
        {
          id: "milo",
          petName: "Milo",
          serviceName: "Bath & Coat Care",
          scheduledStart: 15 * 60,
          appointmentTime: "3:00–4:00 PM",
        },
        {
          id: "bella",
          petName: "Bella",
          serviceName: "Full Groom",
          scheduledStart: 9 * 60,
          appointmentTime: "9:00–10:30 AM",
        },
      ],
      blocks: [
        block({
          id: "personal",
          startMinutes: 12 * 60,
          endMinutes: 14 * 60,
          reason: "Personal",
        }),
      ],
    });
    assert.deepEqual(
      timeline.map((entry) => entry.title),
      ["Bella — Full Groom", "Blocked · Personal", "Milo — Bath & Coat Care"],
    );
    assert.equal(timeline[1]?.timeLabel, "12:00 PM – 2:00 PM");
  });
});

describe("availability block staff gate", () => {
  it("refuses anonymous and non-staff callers before a write", () => {
    assert.equal(
      staffAvailabilityAccessStatus({ error: "unauthenticated" }),
      401,
    );
    assert.equal(staffAvailabilityAccessStatus({ error: "forbidden" }), 403);
    assert.equal(staffAvailabilityAccessStatus({ user: { id: "staff" } }), null);
  });
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { planHistoricalVisits } from "@/lib/visits/backfill";
import {
  activePetCount,
  appendPetToVisitChain,
  planTravelFeeMirror,
  cancelEntireVisit,
  cancelPetOnVisit,
  checkoutEligiblePets,
  deriveVisitStatus,
  listVisitArrivalMinutes,
  scheduleActivePetsFromVisitArrival,
  scheduleVisitPetChain,
  snapshotServiceAddress,
  snapshotServicePrice,
  visitArrivalFields,
  visitArrivalFits,
  visitEstimatedDurationMinutes,
  visitServiceTotal,
  withServiceFinished,
  type VisitPetAppointment,
} from "@/lib/visits/visit";

const VISIT = "visit-v123";

function pet(
  overrides: Partial<VisitPetAppointment> & Pick<VisitPetAppointment, "id" | "petName">,
): VisitPetAppointment {
  return {
    visitId: VISIT,
    status: "confirmed",
    serviceEndedAt: null,
    servicePrice: 100,
    estimatedDurationMinutes: 60,
    scheduledStart: 600,
    ...overrides,
  };
}

function sarahDogs(): VisitPetAppointment[] {
  return [
    pet({
      id: "daisy",
      petName: "Daisy",
      servicePrice: 165,
      estimatedDurationMinutes: 75,
      scheduledStart: 10 * 60,
    }),
    pet({
      id: "milo",
      petName: "Milo",
      servicePrice: 120,
      estimatedDurationMinutes: 100,
      scheduledStart: 11 * 60 + 15,
    }),
    pet({
      id: "coco",
      petName: "Coco",
      servicePrice: 180,
      estimatedDurationMinutes: 60,
      scheduledStart: 13 * 60,
    }),
  ];
}

describe("visit membership", () => {
  it("opens one visit and one appointment for one dog", () => {
    const appointments = [
      pet({ id: "daisy", petName: "Daisy", visitId: "visit-a" }),
    ];
    assert.equal(new Set(appointments.map((row) => row.visitId)).size, 1);
    assert.equal(appointments.length, 1);
    assert.equal(activePetCount(appointments), 1);
  });

  it("keeps three dogs on one visit id", () => {
    const appointments = sarahDogs();
    assert.deepEqual(
      [...new Set(appointments.map((row) => row.visitId))],
      [VISIT],
    );
    assert.equal(appointments.length, 3);
    assert.equal(activePetCount(appointments), 3);
  });

  it("can open two visits for the same customer, date, and address", () => {
    const morning = pet({ id: "daisy", petName: "Daisy", visitId: "visit-a" });
    const afternoon = pet({
      id: "milo",
      petName: "Milo",
      visitId: "visit-b",
      scheduledStart: 13 * 60,
    });
    assert.notEqual(morning.visitId, afternoon.visitId);
  });
});

describe("visit status and partial cancellation", () => {
  it("keeps the visit active when the middle dog is cancelled", () => {
    const next = cancelPetOnVisit(sarahDogs(), "milo");
    assert.equal(next.find((row) => row.id === "milo")?.status, "cancelled");
    assert.equal(next.find((row) => row.id === "daisy")?.status, "confirmed");
    assert.equal(next.find((row) => row.id === "coco")?.status, "confirmed");
    assert.equal(deriveVisitStatus(next), "confirmed");
    assert.equal(activePetCount(next), 2);
    assert.equal(visitEstimatedDurationMinutes(next), 75 + 60);
    assert.equal(visitServiceTotal(next), 165 + 180);
  });

  it("cancels the visit when the last active dog is cancelled", () => {
    let appointments = sarahDogs();
    appointments = cancelPetOnVisit(appointments, "daisy");
    appointments = cancelPetOnVisit(appointments, "milo");
    assert.equal(deriveVisitStatus(appointments), "confirmed");
    appointments = cancelPetOnVisit(appointments, "coco");
    assert.equal(deriveVisitStatus(appointments), "cancelled");
    assert.equal(activePetCount(appointments), 0);
    assert.equal(visitEstimatedDurationMinutes(appointments), 0);
    assert.equal(visitServiceTotal(appointments), 0);
  });

  it("cancels every active dog when the whole visit is cancelled", () => {
    const next = cancelEntireVisit(sarahDogs());
    assert.equal(deriveVisitStatus(next), "cancelled");
    assert.equal(next.every((row) => row.status === "cancelled"), true);
  });

  it("completes a visit when the remaining dogs are finished and one was cancelled", () => {
    let appointments = cancelPetOnVisit(sarahDogs(), "coco");
    appointments = withServiceFinished(appointments, "daisy", "2026-11-23T16:00:00.000Z");
    appointments = withServiceFinished(appointments, "milo", "2026-11-23T17:00:00.000Z");
    assert.equal(deriveVisitStatus(appointments), "completed");
    assert.deepEqual(
      checkoutEligiblePets(appointments).map((row) => row.petName),
      ["Daisy", "Milo"],
    );
  });
});

describe("visit reschedule and add dog", () => {
  it("moves three dogs onto consecutive starts from the new visit start", () => {
    const durations = [75, 100, 60];
    const original = scheduleVisitPetChain({
      visitStartMinutes: 10 * 60,
      durations,
    });
    const moved = scheduleVisitPetChain({
      visitStartMinutes: 13 * 60,
      durations,
    });
    assert.equal(original.ok, true);
    assert.equal(moved.ok, true);
    if (!original.ok || !moved.ok) return;

    assert.deepEqual(
      original.slots.map((slot) => slot.scheduledStart),
      [10 * 60, 11 * 60 + 15, 12 * 60 + 55],
    );
    assert.deepEqual(
      moved.slots.map((slot) => slot.scheduledStart),
      [13 * 60, 14 * 60 + 15, 15 * 60 + 55],
    );
    assert.equal(new Set(moved.slots.map((slot) => slot.scheduledStart)).size, 3);
    assert.equal(
      moved.slots.every((slot) => slot.scheduledStart === 13 * 60),
      false,
    );
  });

  it("adds a dog after the current chain instead of reusing the visit start", () => {
    const existing = sarahDogs().slice(0, 2);
    const last = existing[existing.length - 1]!;
    const added = appendPetToVisitChain({
      previousStart: last.scheduledStart!,
      previousDurationMinutes: last.estimatedDurationMinutes,
      durationMinutes: 60,
    });
    assert.ok(added);
    assert.notEqual(added.scheduledStart, existing[0]?.scheduledStart);
    assert.equal(added.scheduledStart > (last.scheduledStart ?? 0), true);
    const visitId = existing[0]?.visitId;
    assert.equal(visitId, VISIT);
    assert.equal(
      [...existing, pet({ id: "coco", petName: "Coco", visitId: visitId! })].every(
        (row) => row.visitId === visitId,
      ),
      true,
    );
  });
});

describe("Sarah's three-dog visit at 3:30 PM", () => {
  const arrival = 15 * 60 + 30;
  const durations = [75, 100, 60];

  function sarahAtThreeThirty(): VisitPetAppointment[] {
    const chain = scheduleVisitPetChain({
      visitStartMinutes: arrival,
      durations,
    });
    if (!chain.ok) throw new Error("chain");
    return [
      pet({
        id: "daisy",
        petName: "Daisy",
        estimatedDurationMinutes: 75,
        scheduledStart: chain.slots[0]!.scheduledStart,
      }),
      pet({
        id: "milo",
        petName: "Milo",
        estimatedDurationMinutes: 100,
        scheduledStart: chain.slots[1]!.scheduledStart,
      }),
      pet({
        id: "coco",
        petName: "Coco",
        estimatedDurationMinutes: 60,
        scheduledStart: chain.slots[2]!.scheduledStart,
      }),
    ];
  }

  it("schedules November 23 at 3:30 PM as one visit arrival", () => {
    const chain = scheduleVisitPetChain({
      visitStartMinutes: arrival,
      durations,
    });
    assert.equal(chain.ok, true);
    if (!chain.ok) return;
    assert.equal(visitEstimatedDurationMinutes(sarahAtThreeThirty()), 235);
    assert.deepEqual(
      chain.slots.map((slot) => slot.scheduledStart),
      [15 * 60 + 30, 16 * 60 + 45, 18 * 60 + 25],
    );
    assert.deepEqual(
      chain.slots.map((slot) => slot.appointmentTime),
      ["3:30 PM", "3:30 PM", "3:30 PM"],
    );
    assert.equal(new Set(chain.slots.map((slot) => slot.scheduledStart)).size, 3);
  });

  it("offers 3:30 PM only when the full 235-minute visit fits other visits", () => {
    const otherVisit = [{ scheduledStart: 18 * 60, durationMinutes: 60 }];
    assert.equal(
      visitArrivalFits({
        visitStartMinutes: arrival,
        durations: [75],
        otherStops: otherVisit,
      }),
      true,
    );
    assert.equal(
      visitArrivalFits({
        visitStartMinutes: arrival,
        durations,
        otherStops: otherVisit,
      }),
      false,
    );
    assert.equal(
      listVisitArrivalMinutes({ durations, otherStops: [] }).includes(arrival),
      true,
    );
    assert.equal(
      listVisitArrivalMinutes({ durations, otherStops: otherVisit }).includes(
        arrival,
      ),
      false,
    );
    assert.equal(
      visitArrivalFits({
        visitStartMinutes: arrival,
        durations,
        otherStops: [],
      }),
      true,
    );
  });

  it("keeps 3:30 PM and closes the gap when Milo is cancelled", () => {
    const next = scheduleActivePetsFromVisitArrival(
      cancelPetOnVisit(sarahAtThreeThirty(), "milo"),
    );
    assert.ok(next);
    assert.equal(next?.visitStartMinutes, arrival);
    assert.deepEqual(
      next?.slots.map((slot) => [slot.id, slot.scheduledStart]),
      [
        ["daisy", 15 * 60 + 30],
        ["coco", 16 * 60 + 45],
      ],
    );
  });

  it("reflows the dogs after Milo when his service gets shorter", () => {
    const dogs = sarahAtThreeThirty().map((dog) =>
      dog.id === "milo" ? { ...dog, estimatedDurationMinutes: 60 } : dog,
    );
    const next = scheduleActivePetsFromVisitArrival(dogs);
    assert.equal(next?.visitStartMinutes, arrival);
    assert.deepEqual(
      next?.slots.map((slot) => [slot.id, slot.scheduledStart]),
      [
        ["daisy", 15 * 60 + 30],
        ["milo", 16 * 60 + 45],
        ["coco", 17 * 60 + 45],
      ],
    );
  });

  it("adds Coco after Daisy and Milo without moving the 3:30 PM arrival", () => {
    const existing = sarahAtThreeThirty().slice(0, 2);
    const last = existing[1]!;
    const added = appendPetToVisitChain({
      previousStart: last.scheduledStart!,
      previousDurationMinutes: last.estimatedDurationMinutes,
      durationMinutes: 60,
    });
    assert.equal(added?.scheduledStart, 18 * 60 + 25);
    const withCoco = scheduleVisitPetChain({
      visitStartMinutes: arrival,
      durations: [75, 100, 60],
    });
    assert.equal(withCoco.ok, true);
    if (!withCoco.ok) return;
    assert.equal(withCoco.slots[0]?.scheduledStart, arrival);
    assert.equal(withCoco.slots[2]?.scheduledStart, added?.scheduledStart);
  });
});

describe("visit travel fee mirror", () => {
  it("keeps one travel fee on an active dog after the middle dog is cancelled", () => {
    const dogs = [
      { id: "daisy", status: "confirmed" as const, travelFee: 32.5, scheduledStart: 600 },
      { id: "milo", status: "cancelled" as const, travelFee: 0, scheduledStart: 675 },
      { id: "coco", status: "confirmed" as const, travelFee: 0, scheduledStart: 775 },
    ];
    assert.deepEqual(planTravelFeeMirror(dogs, 32.5), [
      { id: "daisy", travelFee: 32.5 },
      { id: "milo", travelFee: 0 },
      { id: "coco", travelFee: 0 },
    ]);
  });

  it("moves the travel fee when the dog carrying it is cancelled", () => {
    const dogs = [
      { id: "daisy", status: "cancelled" as const, travelFee: 32.5, scheduledStart: 600 },
      { id: "milo", status: "confirmed" as const, travelFee: 0, scheduledStart: 675 },
      { id: "coco", status: "confirmed" as const, travelFee: 0, scheduledStart: 775 },
    ];
    assert.deepEqual(
      planTravelFeeMirror(dogs, 32.5).map((row) => [row.id, row.travelFee]),
      [
        ["daisy", 0],
        ["milo", 32.5],
        ["coco", 0],
      ],
    );
  });

  it("clears appointment mirrors when every dog is cancelled", () => {
    const dogs = [
      { id: "daisy", status: "cancelled" as const, travelFee: 32.5, scheduledStart: 600 },
      { id: "milo", status: "cancelled" as const, travelFee: 0, scheduledStart: 675 },
    ];
    assert.deepEqual(planTravelFeeMirror(dogs, 32.5), [
      { id: "daisy", travelFee: 0 },
      { id: "milo", travelFee: 0 },
    ]);
  });
});

describe("visit snapshots", () => {
  it("keeps the historical service address after the customer profile changes", () => {
    const customer = {
      street: "100 Olive Ave",
      city: "West Palm Beach",
      state: "FL",
      zip: "33401",
    };
    const visitAddress = snapshotServiceAddress(customer);
    customer.street = "50 Jupiter Lakes Blvd";
    customer.city = "Jupiter";
    customer.zip = "33458";
    assert.deepEqual(visitAddress, {
      street: "100 Olive Ave",
      city: "West Palm Beach",
      state: "FL",
      zip: "33401",
    });
  });

  it("keeps the booked service price after the catalog price changes", () => {
    const booked = snapshotServicePrice(165);
    const laterCatalogPrice = 190;
    assert.equal(booked, 165);
    assert.notEqual(booked, laterCatalogPrice);
  });

  it("uses the stored duration snapshot instead of a later duration rule", () => {
    const appointments = [
      pet({
        id: "daisy",
        petName: "Daisy",
        estimatedDurationMinutes: 75,
      }),
    ];
    const laterRuleMinutes = 999;
    assert.equal(visitEstimatedDurationMinutes(appointments), 75);
    assert.notEqual(visitEstimatedDurationMinutes(appointments), laterRuleMinutes);
  });

  it("keeps travel off the per-pet service total", () => {
    const appointments = sarahDogs();
    const travelFee = 32.5;
    assert.equal(visitServiceTotal(appointments), 165 + 120 + 180);
    assert.equal(
      Math.round((visitServiceTotal(appointments) + travelFee) * 100) / 100,
      465 + 32.5,
    );
  });
});

describe("historical visit backfill migration", () => {
  it("merges only a shared confirmation token and refuses visit deletes", () => {
    const sql = readFileSync(
      new URL(
        "../../../supabase/migrations/20261006120000_visits.sql",
        import.meta.url,
      ),
      "utf8",
    );
    const integrity = readFileSync(
      new URL(
        "../../../supabase/migrations/20261007140000_visit_integrity.sql",
        import.meta.url,
      ),
      "utf8",
    );
    assert.equal(sql.includes("cluster_customer"), false);
    assert.equal(sql.includes("cluster_date"), false);
    assert.equal(sql.includes("cluster_address"), false);
    assert.equal(sql.includes("interval '15 seconds'"), false);
    assert.match(sql, /customer_confirm_token_hash/);
    assert.match(sql, /'single:' \|\| id::text/);
    assert.match(sql, /REFERENCES public\.visits \(id\) ON DELETE RESTRICT/);
    assert.doesNotMatch(sql, /REFERENCES public\.visits \(id\) ON DELETE CASCADE/);
    assert.match(sql, /visits\.travel_fee is the source of truth/i);
    assert.match(sql, /public\.visit_arrival_label\(v_start\)/);
    assert.match(integrity, /ON DELETE RESTRICT/);
    assert.match(integrity, /FUNCTION public\.create_staff_visit/);
    assert.match(integrity, /FUNCTION public\.replace_visit_schedule/);
    assert.match(
      integrity,
      /REVOKE ALL ON FUNCTION public\.create_staff_visit\(jsonb, jsonb\) FROM authenticated/,
    );
    assert.match(
      integrity,
      /GRANT EXECUTE ON FUNCTION public\.create_staff_visit\(jsonb, jsonb\) TO service_role/,
    );
    assert.match(
      integrity,
      /GRANT EXECUTE ON FUNCTION public\.replace_visit_schedule\(uuid, date, integer, text, jsonb\) TO service_role/,
    );
    assert.match(integrity, /visits_appointment_time_matches_start/);
    assert.doesNotMatch(integrity, /ON DELETE CASCADE/);
  });
});

describe("visit arrival source of truth", () => {
  it("derives the display label from the canonical arrival minute", () => {
    assert.deepEqual(visitArrivalFields(15 * 60 + 30), {
      scheduledStart: 15 * 60 + 30,
      appointmentTime: "3:30 PM",
    });
    assert.equal(visitArrivalFields(15 * 60).appointmentTime, "3:00 PM");
    assert.equal(visitArrivalFields(0).appointmentTime, "12:00 AM");
    assert.equal(visitArrivalFields(12 * 60).appointmentTime, "12:00 PM");
  });
});

describe("historical visit backfill", () => {
  const address = {
    addressStreet: "100 Olive Ave",
    addressZip: "33401",
  };

  it("merges a staff booking that shares one confirmation token", () => {
    const groups = planHistoricalVisits([
      row("a", { confirmTokenHash: "token-1", createdAt: "2026-11-01T14:00:00.000Z", scheduledStart: 600 }),
      row("b", { confirmTokenHash: "token-1", createdAt: "2026-11-01T14:00:01.000Z", scheduledStart: 675 }),
      row("c", { confirmTokenHash: "token-1", createdAt: "2026-11-01T14:00:02.000Z", scheduledStart: 780 }),
    ]);
    assert.deepEqual(groups, [
      { reason: "confirm_token", appointmentIds: ["a", "b", "c"] },
    ]);
  });

  it("does not merge dogs created seconds apart at the same address", () => {
    const groups = planHistoricalVisits([
      row("daisy", { createdAt: "2026-11-01T14:00:00.000Z", scheduledStart: 600 }),
      row("milo", { createdAt: "2026-11-01T14:00:02.000Z", scheduledStart: 675 }),
      row("later", {
        createdAt: "2026-11-01T15:00:00.000Z",
        scheduledStart: 13 * 60,
      }),
    ]);
    assert.deepEqual(
      groups.map((group) => ({
        reason: group.reason,
        appointmentIds: group.appointmentIds,
      })),
      [
        { reason: "unmatched_single", appointmentIds: ["daisy"] },
        { reason: "unmatched_single", appointmentIds: ["milo"] },
        { reason: "unmatched_single", appointmentIds: ["later"] },
      ],
    );
  });

  it("does not treat a blank confirmation token as a shared booking", () => {
    const groups = planHistoricalVisits([
      row("a", { confirmTokenHash: "  ", scheduledStart: 600 }),
      row("b", { confirmTokenHash: "", scheduledStart: 675 }),
    ]);
    assert.deepEqual(
      groups.map((group) => group.reason),
      ["unmatched_single", "unmatched_single"],
    );
  });

  it("does not merge two tokenized bookings that happen to share an address", () => {
    const groups = planHistoricalVisits([
      row("a", {
        confirmTokenHash: "token-a",
        createdAt: "2026-11-01T14:00:00.000Z",
        scheduledStart: 600,
      }),
      row("b", {
        confirmTokenHash: "token-b",
        createdAt: "2026-11-01T14:00:01.000Z",
        scheduledStart: 675,
      }),
    ]);
    assert.equal(groups.length, 2);
    assert.deepEqual(
      groups.map((group) => group.reason),
      ["confirm_token", "confirm_token"],
    );
  });

  it("does not merge rows that share a start time", () => {
    const groups = planHistoricalVisits([
      row("a", { createdAt: "2026-11-01T14:00:00.000Z", scheduledStart: 600 }),
      row("b", { createdAt: "2026-11-01T14:00:01.000Z", scheduledStart: 600 }),
    ]);
    assert.deepEqual(
      groups.map((group) => group.reason),
      ["unmatched_single", "unmatched_single"],
    );
  });

  function row(
    id: string,
    overrides: Partial<{
      confirmTokenHash: string | null;
      createdAt: string;
      scheduledStart: number | null;
      appointmentDate: string;
      addressStreet: string;
    }> = {},
  ) {
    return {
      id,
      customerId: "sarah",
      appointmentDate: overrides.appointmentDate ?? "2026-11-23",
      ...address,
      addressStreet: overrides.addressStreet ?? address.addressStreet,
      scheduledStart: overrides.scheduledStart ?? null,
      createdAt: overrides.createdAt ?? "2026-11-01T14:00:00.000Z",
      confirmTokenHash: overrides.confirmTokenHash ?? null,
    };
  }
});

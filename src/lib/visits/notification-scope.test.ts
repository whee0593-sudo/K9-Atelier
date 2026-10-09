import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatVisitPetNames } from "@/lib/visits/pet-names";
import {
  memoryVisitNotificationStore,
  recordVisitNotificationSent,
  runVisitNotification,
} from "@/lib/visits/notification-ledger";
import {
  activeVisitPets,
  groupByVisit,
  isPetRecordNotice,
  isVisitLogisticsEvent,
  petsReadyForCheckout,
  planStaffStatusNotice,
  type VisitNoticePet,
} from "@/lib/visits/notification-scope";

function pet(patch: Partial<VisitNoticePet> & Pick<VisitNoticePet, "id" | "petName">): VisitNoticePet {
  return {
    serviceName: "Bath",
    status: "confirmed",
    serviceEndedAt: null,
    sex: null,
    ...patch,
  };
}

describe("visit pet names", () => {
  it("lists one, two, and three dogs in one phrase", () => {
    assert.equal(formatVisitPetNames(["Daisy"]), "Daisy");
    assert.equal(formatVisitPetNames(["Daisy", "Milo"]), "Daisy and Milo");
    assert.equal(
      formatVisitPetNames(["Daisy", "Milo", "Coco"]),
      "Daisy, Milo and Coco",
    );
  });

  it("drops blanks and repeated names", () => {
    assert.equal(formatVisitPetNames([" Daisy ", "", "Daisy", "Milo"]), "Daisy and Milo");
    assert.equal(formatVisitPetNames([]), "your dog");
  });
});

describe("notification scope", () => {
  it("keeps service logistics on the visit and pet records on the dog", () => {
    assert.equal(isVisitLogisticsEvent("booking_confirmation"), true);
    assert.equal(isVisitLogisticsEvent("google_review_request"), true);
    assert.equal(isVisitLogisticsEvent("rabies_vaccination"), false);
    assert.equal(isPetRecordNotice("rabies_vaccination"), true);
    assert.equal(isPetRecordNotice("pet_medical_behavior"), true);
    assert.equal(isPetRecordNotice("missing_pet_details"), true);
    assert.equal(isPetRecordNotice("en_route"), false);
    assert.equal(isVisitLogisticsEvent("pet_medical_behavior"), false);
  });

  it("groups sibling appointments and leaves separate visits apart", () => {
    const groups = groupByVisit([
      { id: "a", visitId: "visit-1" },
      { id: "b", visitId: "visit-1" },
      { id: "c", visitId: "visit-2" },
      { id: "d", visitId: null },
    ]);
    assert.deepEqual(
      groups.map((group) => group.map((row) => row.id)),
      [["a", "b"], ["c"], ["d"]],
    );
  });
});

describe("staff status notices", () => {
  const daisy = pet({ id: "a", petName: "Daisy", status: "pending_confirmation" });
  const milo = pet({ id: "b", petName: "Milo", status: "pending_confirmation" });
  const coco = pet({ id: "c", petName: "Coco", status: "pending_confirmation" });

  it("waits to confirm until every dog on the visit is confirmed", () => {
    const waiting = planStaffStatusNotice({
      kind: "confirmed",
      appointmentId: "a",
      petName: "Daisy",
      siblings: [
        { ...daisy, status: "confirmed" },
        milo,
        coco,
      ],
    });
    assert.deepEqual(waiting, { send: false, reason: "waiting_for_siblings" });

    const ready = planStaffStatusNotice({
      kind: "confirmed",
      appointmentId: "c",
      petName: "Coco",
      siblings: [daisy, milo, coco].map((row) => ({ ...row, status: "confirmed" })),
    });
    assert.equal(ready.send, true);
    if (!ready.send) return;
    assert.equal(ready.eventKey, "staff_confirmed");
    assert.deepEqual(
      ready.pets.map((row) => row.petName),
      ["Daisy", "Milo", "Coco"],
    );
  });

  it("sends one visit cancellation only when no dog remains", () => {
    const partial = planStaffStatusNotice({
      kind: "staff_cancelled",
      appointmentId: "a",
      petName: "Daisy",
      siblings: [
        { ...daisy, status: "cancelled" },
        { ...milo, status: "confirmed" },
        { ...coco, status: "confirmed" },
      ],
    });
    assert.equal(partial.send, true);
    if (!partial.send) return;
    assert.equal(partial.scope, "pet");
    assert.equal(partial.eventKey, "staff_cancelled:a");
    assert.deepEqual(partial.pets.map((row) => row.petName), ["Daisy"]);

    const visit = planStaffStatusNotice({
      kind: "declined",
      appointmentId: "c",
      petName: "Coco",
      siblings: [daisy, milo, coco].map((row) => ({ ...row, status: "cancelled" })),
    });
    assert.equal(visit.send, true);
    if (!visit.send) return;
    assert.equal(visit.scope, "visit");
    assert.equal(visit.event, "staff_declined");
    assert.deepEqual(
      visit.pets.map((row) => row.petName),
      ["Daisy", "Milo", "Coco"],
    );
  });
});

describe("checkout and en route pets", () => {
  it("holds the ready text until every remaining dog is finished", () => {
    const pets = [
      pet({ id: "a", petName: "Daisy", serviceEndedAt: "2026-10-09T15:00:00.000Z" }),
      pet({ id: "b", petName: "Milo" }),
      pet({ id: "c", petName: "Coco", status: "cancelled" }),
    ];
    assert.equal(petsReadyForCheckout(pets), null);
    const ready = petsReadyForCheckout([
      pets[0]!,
      { ...pets[1]!, serviceEndedAt: "2026-10-09T16:00:00.000Z" },
      pets[2]!,
    ]);
    assert.deepEqual(ready?.map((row) => row.petName), ["Daisy", "Milo"]);
    assert.deepEqual(activeVisitPets(pets)?.map((row) => row.petName), ["Daisy", "Milo"]);
  });
});

describe("visit notification ledger", () => {
  it("sends once and lets a failed attempt try again", async () => {
    const store = memoryVisitNotificationStore();
    let sends = 0;
    const first = await runVisitNotification({
      visitId: "visit-1",
      event: "booking_confirmation",
      store,
      send: async () => {
        sends += 1;
        return false;
      },
    });
    assert.equal(first, "failed");
    const second = await runVisitNotification({
      visitId: "visit-1",
      event: "booking_confirmation",
      store,
      send: async () => {
        sends += 1;
        return true;
      },
    });
    const third = await runVisitNotification({
      visitId: "visit-1",
      event: "booking_confirmation",
      store,
      send: async () => {
        sends += 1;
        return true;
      },
    });
    assert.equal(second, "sent");
    assert.equal(third, "skipped");
    assert.equal(sends, 2);
  });

  it("does not send a second google review after the follow-up recorded it", async () => {
    const store = memoryVisitNotificationStore();
    await recordVisitNotificationSent("visit-1", "google_review_request", store);
    let sends = 0;
    const result = await runVisitNotification({
      visitId: "visit-1",
      event: "google_review_request",
      store,
      send: async () => {
        sends += 1;
        return true;
      },
    });
    assert.equal(result, "skipped");
    assert.equal(sends, 0);
  });
});

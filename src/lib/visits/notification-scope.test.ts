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
  customerChangeNoticePlan,
  groupByVisit,
  isPetRecordNotice,
  isVisitLogisticsEvent,
  petsReadyForCheckout,
  planStaffStatusNotice,
  rescheduleNotificationEvent,
  type VisitNoticePet,
} from "@/lib/visits/notification-scope";
import {
  classifyProviderHttpStatus,
  combineProviderDeliveries,
} from "@/lib/visits/provider-delivery";
import { decideExistingVisitClaim } from "@/lib/visits/notification-ledger";

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

  it("retries a definite rejection and holds an uncertain delivery", async () => {
    const store = memoryVisitNotificationStore();
    let sends = 0;
    const rejected = await runVisitNotification({
      visitId: "visit-1",
      event: "en_route",
      store,
      send: async () => {
        sends += 1;
        return "rejected";
      },
    });
    const delivered = await runVisitNotification({
      visitId: "visit-1",
      event: "en_route",
      store,
      send: async () => {
        sends += 1;
        return "delivered";
      },
    });
    assert.equal(rejected, "failed");
    assert.equal(delivered, "sent");

    const uncertain = await runVisitNotification({
      visitId: "visit-1",
      event: "checkout_ready",
      store,
      send: async () => {
        sends += 1;
        return "uncertain";
      },
    });
    const retry = await runVisitNotification({
      visitId: "visit-1",
      event: "checkout_ready",
      store,
      send: async () => {
        sends += 1;
        return true;
      },
    });
    assert.equal(uncertain, "failed");
    assert.equal(retry, "skipped");
    assert.equal(sends, 3);
  });

  it("does not retry when the provider call throws", async () => {
    const store = memoryVisitNotificationStore();
    let sends = 0;
    const first = await runVisitNotification({
      visitId: "visit-1",
      event: "payment_thank_you",
      store,
      send: async () => {
        sends += 1;
        throw new Error("timeout");
      },
    });
    const second = await runVisitNotification({
      visitId: "visit-1",
      event: "payment_thank_you",
      store,
      send: async () => {
        sends += 1;
        return true;
      },
    });
    assert.equal(first, "failed");
    assert.equal(second, "skipped");
    assert.equal(sends, 1);
  });

  it("does not send again when the sent mark fails after delivery", async () => {
    const base = memoryVisitNotificationStore();
    let failComplete = true;
    const store = {
      ...base,
      complete: async (visitId: string, event: string) => {
        if (failComplete) {
          failComplete = false;
          return false;
        }
        return base.complete(visitId, event);
      },
    };
    let sends = 0;
    const first = await runVisitNotification({
      visitId: "visit-1",
      event: "booking_confirmation",
      store,
      send: async () => {
        sends += 1;
        return true;
      },
    });
    const second = await runVisitNotification({
      visitId: "visit-1",
      event: "booking_confirmation",
      store,
      send: async () => {
        sends += 1;
        return true;
      },
    });
    assert.equal(first, "sent");
    assert.equal(second, "skipped");
    assert.equal(sends, 1);
  });

  it("skips a second caller while the first send is still in flight", async () => {
    const store = memoryVisitNotificationStore();
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let started: () => void = () => {};
    const startedPromise = new Promise<void>((resolve) => {
      started = resolve;
    });
    let sends = 0;
    const first = runVisitNotification({
      visitId: "visit-1",
      event: "staff_confirmed",
      store,
      send: async () => {
        sends += 1;
        started();
        await gate;
        return true;
      },
    });
    await startedPromise;
    const second = await runVisitNotification({
      visitId: "visit-1",
      event: "staff_confirmed",
      store,
      send: async () => {
        sends += 1;
        return true;
      },
    });
    release();
    assert.equal(await first, "sent");
    assert.equal(second, "skipped");
    assert.equal(sends, 1);
  });

  it("reclaims only a claim that never contacted the provider", async () => {
    let clock = Date.parse("2026-10-09T12:00:00.000Z");
    const store = memoryVisitNotificationStore({ now: () => clock });
    assert.equal(await store.claim("visit-1", "en_route"), "claimed");
    clock += 15 * 60 * 1000;
    assert.equal(await store.claim("visit-1", "en_route"), "claimed");

    assert.equal(await store.markAttempted("visit-1", "en_route"), true);
    clock += 15 * 60 * 1000;
    assert.equal(await store.claim("visit-1", "en_route"), "sending");
    await store.hold("visit-1", "en_route");
    clock += 15 * 60 * 1000;
    assert.equal(await store.claim("visit-1", "en_route"), "uncertain");
  });
});

describe("provider delivery outcomes", () => {
  it("treats timeout and server errors as uncertain and client errors as rejected", () => {
    assert.equal(classifyProviderHttpStatus(202), "delivered");
    assert.equal(classifyProviderHttpStatus(400), "rejected");
    assert.equal(classifyProviderHttpStatus(401), "rejected");
    assert.equal(classifyProviderHttpStatus(422), "rejected");
    assert.equal(classifyProviderHttpStatus(408), "uncertain");
    assert.equal(classifyProviderHttpStatus(409), "uncertain");
    assert.equal(classifyProviderHttpStatus(500), "uncertain");
    assert.equal(classifyProviderHttpStatus(503), "uncertain");
    assert.equal(
      combineProviderDeliveries(["rejected", "uncertain"]),
      "uncertain",
    );
    assert.equal(
      combineProviderDeliveries(["uncertain", "delivered"]),
      "delivered",
    );
    assert.equal(combineProviderDeliveries(["rejected", "rejected"]), "rejected");
  });

  it("does not resend a row that already attempted delivery", () => {
    const now = Date.parse("2026-10-09T13:00:00.000Z");
    const createdAt = new Date(now - 20 * 60 * 1000).toISOString();
    assert.equal(
      decideExistingVisitClaim(
        { status: "sending", createdAt, attemptedAt: null },
        now,
      ),
      "reclaim",
    );
    assert.equal(
      decideExistingVisitClaim(
        { status: "sending", createdAt, attemptedAt: createdAt },
        now,
      ),
      "sending",
    );
    assert.equal(
      decideExistingVisitClaim(
        { status: "uncertain", createdAt, attemptedAt: createdAt },
        now,
      ),
      "uncertain",
    );
    assert.equal(
      decideExistingVisitClaim({ status: "sent", createdAt, attemptedAt: createdAt }, now),
      "sent",
    );
  });
});

describe("multi-pet visit notice identity", () => {
  it("does not let a later add-dog notice reuse the booking confirmation", async () => {
    const store = memoryVisitNotificationStore();
    await recordVisitNotificationSent("visit-1", "booking_confirmation", store);
    const added = customerChangeNoticePlan({
      action: "add_dog",
      date: "2026-10-10",
      timeLabel: "10:00 AM",
    });
    assert.equal(added.claim, false);
    const again = await runVisitNotification({
      visitId: "visit-1",
      event: "booking_confirmation",
      store,
      send: async () => true,
    });
    assert.equal(again, "skipped");
  });

  it("notifies each cancelled pet on its own key and leaves the other pets alone", async () => {
    const store = memoryVisitNotificationStore();
    const daisy = planStaffStatusNotice({
      kind: "staff_cancelled",
      appointmentId: "a",
      petName: "Daisy",
      siblings: [
        pet({ id: "a", petName: "Daisy", status: "cancelled" }),
        pet({ id: "b", petName: "Milo", status: "confirmed" }),
      ],
    });
    const milo = planStaffStatusNotice({
      kind: "staff_cancelled",
      appointmentId: "b",
      petName: "Milo",
      siblings: [
        pet({ id: "a", petName: "Daisy", status: "cancelled" }),
        pet({ id: "b", petName: "Milo", status: "cancelled" }),
      ],
    });
    assert.equal(daisy.send && daisy.eventKey, "staff_cancelled:a");
    assert.equal(milo.send && milo.scope, "visit");
    assert.deepEqual(
      daisy.send ? daisy.pets.map((row) => row.petName) : [],
      ["Daisy"],
    );

    assert.equal(
      await runVisitNotification({
        visitId: "visit-1",
        event: daisy.send ? daisy.eventKey : "missing",
        store,
        send: async () => true,
      }),
      "sent",
    );
    assert.equal(
      await runVisitNotification({
        visitId: "visit-1",
        event: "staff_confirmed",
        store,
        send: async () => true,
      }),
      "sent",
    );
    assert.equal(
      await runVisitNotification({
        visitId: "visit-1",
        event: "staff_cancelled:b",
        store,
        send: async () => true,
      }),
      "sent",
    );
    assert.equal(
      await runVisitNotification({
        visitId: "visit-1",
        event: "staff_cancelled:a",
        store,
        send: async () => true,
      }),
      "skipped",
    );
  });

  it("waits to confirm when the other pets cannot be loaded", () => {
    const waiting = planStaffStatusNotice({
      kind: "confirmed",
      appointmentId: "a",
      petName: "Daisy",
      siblings: null,
    });
    assert.deepEqual(waiting, { send: false, reason: "waiting_for_siblings" });

    const partial = planStaffStatusNotice({
      kind: "staff_cancelled",
      appointmentId: "a",
      petName: "Daisy",
      siblings: null,
    });
    assert.equal(partial.send, true);
    if (!partial.send) return;
    assert.equal(partial.scope, "pet");
    assert.equal(partial.eventKey, "staff_cancelled:a");
    assert.deepEqual(partial.pets.map((row) => row.petName), ["Daisy"]);
  });

  it("sends a second reschedule when the visit moves again, including back", async () => {
    const first = rescheduleNotificationEvent("2026-10-11", "11:00 AM", {
      date: "2026-10-10",
      timeLabel: "10:00 AM",
    });
    const same = rescheduleNotificationEvent("2026-10-11", "11:00 AM", {
      date: "2026-10-10",
      timeLabel: "10:00 AM",
    });
    const back = rescheduleNotificationEvent("2026-10-10", "10:00 AM", {
      date: "2026-10-11",
      timeLabel: "11:00 AM",
    });
    const plan = customerChangeNoticePlan({
      action: "reschedule",
      date: "2026-10-11",
      timeLabel: "11:00 AM",
      previousDate: "2026-10-10",
      previousTime: "10:00 AM",
    });
    assert.equal(first, same);
    assert.notEqual(first, back);
    assert.equal(plan.claim, true);
    if (!plan.claim) return;
    assert.equal(plan.event, first);

    const store = memoryVisitNotificationStore();
    assert.equal(
      await runVisitNotification({
        visitId: "visit-1",
        event: first,
        store,
        send: async () => true,
      }),
      "sent",
    );
    assert.equal(
      await runVisitNotification({
        visitId: "visit-1",
        event: same,
        store,
        send: async () => true,
      }),
      "skipped",
    );
    assert.equal(
      await runVisitNotification({
        visitId: "visit-1",
        event: back,
        store,
        send: async () => true,
      }),
      "sent",
    );
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { visitLogisticsKey } from "@/lib/communications/keys";
import {
  planNextDayFollowUp,
  planRebookReminder,
  planVisitLogisticsSms,
} from "@/lib/communications/visit-readiness";

const TEN_AM = new Date("2026-09-23T14:00:00.000Z");

describe("visit logistics", () => {
  it("uses one visit key for every dog", () => {
    const visitId = "AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEEE";
    assert.equal(
      visitLogisticsKey(visitId, "en_route"),
      visitLogisticsKey(visitId.toLowerCase(), "en_route"),
    );
    assert.equal(visitLogisticsKey(visitId, "en_route").includes("dog-"), false);
  });

  it("waits to text checkout until every active dog is finished", () => {
    const waiting = planVisitLogisticsSms({
      event: "checkout_ready",
      dogs: [
        { appointmentId: "apt-1", status: "confirmed", serviceEndedAt: "2026-09-22T18:00:00.000Z" },
        { appointmentId: "apt-2", status: "confirmed", serviceEndedAt: null },
        { appointmentId: "apt-3", status: "cancelled", serviceEndedAt: null },
      ],
    });
    assert.equal(waiting.action, "wait");
    const ready = planVisitLogisticsSms({
      event: "checkout_ready",
      dogs: [
        { appointmentId: "apt-1", status: "confirmed", serviceEndedAt: "2026-09-22T18:00:00.000Z" },
        { appointmentId: "apt-2", status: "confirmed", serviceEndedAt: "2026-09-22T19:00:00.000Z" },
      ],
    });
    assert.equal(ready.action, "send");
    assert.deepEqual(ready.appointmentIds, ["apt-1", "apt-2"]);
  });
});

describe("next-day follow-up visit gate", () => {
  it("does not send or close the window while a dog is unfinished", () => {
    const dogs = [
      {
        appointmentId: "apt-1",
        status: "confirmed",
        serviceEndedAt: "2026-09-22T18:00:00.000Z",
        followupSentAt: null,
      },
      {
        appointmentId: "apt-2",
        status: "confirmed",
        serviceEndedAt: null,
        followupSentAt: null,
      },
    ];
    const held = planNextDayFollowUp({ dogs, now: TEN_AM });
    assert.equal(held.action, "wait");
    if (held.action === "wait") {
      assert.equal(held.reason, "waiting_for_checkout");
    }
    const later = planNextDayFollowUp({
      dogs: [
        dogs[0]!,
        { ...dogs[1]!, serviceEndedAt: "2026-09-23T18:00:00.000Z" },
      ],
      now: new Date("2026-09-24T14:00:00.000Z"),
    });
    assert.equal(later.action, "send");
  });

  it("does not send again when one dog was already marked", () => {
    const plan = planNextDayFollowUp({
      dogs: [
        {
          appointmentId: "apt-1",
          status: "confirmed",
          serviceEndedAt: "2026-09-22T18:00:00.000Z",
          followupSentAt: "2026-09-23T14:00:00.000Z",
        },
        {
          appointmentId: "apt-2",
          status: "confirmed",
          serviceEndedAt: "2026-09-22T19:00:00.000Z",
          followupSentAt: null,
        },
      ],
      now: TEN_AM,
    });
    assert.equal(plan.action, "already_sent");
  });
});

describe("21-day visit gate", () => {
  it("waits for the unfinished dog and does not start from the first dog", () => {
    const waiting = planRebookReminder({
      now: TEN_AM,
      hasOpenFuture: false,
      dogs: [
        {
          appointmentId: "apt-1",
          status: "confirmed",
          serviceEndedAt: "2026-09-02T16:00:00.000Z",
          reminderStatus: null,
        },
        {
          appointmentId: "apt-2",
          status: "confirmed",
          serviceEndedAt: null,
          reminderStatus: null,
        },
      ],
    });
    assert.equal(waiting.action, "wait");
    if (waiting.action === "wait") {
      assert.equal(waiting.reason, "waiting_for_checkout");
    }

    const tooEarly = planRebookReminder({
      now: TEN_AM,
      hasOpenFuture: false,
      dogs: [
        {
          appointmentId: "apt-1",
          status: "confirmed",
          serviceEndedAt: "2026-09-02T16:00:00.000Z",
          reminderStatus: null,
        },
        {
          appointmentId: "apt-2",
          status: "confirmed",
          serviceEndedAt: "2026-09-10T16:00:00.000Z",
          reminderStatus: null,
        },
      ],
    });
    assert.equal(tooEarly.action, "wait");
    if (tooEarly.action === "wait") assert.equal(tooEarly.reason, "too_early");

    const ready = planRebookReminder({
      now: new Date("2026-10-01T14:00:00.000Z"),
      hasOpenFuture: false,
      dogs: [
        {
          appointmentId: "apt-1",
          status: "confirmed",
          serviceEndedAt: "2026-09-02T16:00:00.000Z",
          reminderStatus: null,
        },
        {
          appointmentId: "apt-2",
          status: "confirmed",
          serviceEndedAt: "2026-09-10T16:00:00.000Z",
          reminderStatus: null,
        },
      ],
    });
    assert.equal(ready.action, "send");
  });

  it("holds an in-flight reminder instead of sending again", () => {
    const plan = planRebookReminder({
      now: TEN_AM,
      hasOpenFuture: false,
      dogs: [
        {
          appointmentId: "apt-1",
          status: "confirmed",
          serviceEndedAt: "2026-09-02T16:00:00.000Z",
          reminderStatus: "sending",
        },
      ],
    });
    assert.equal(plan.action, "wait");
    if (plan.action === "wait") assert.equal(plan.reason, "in_flight");
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  runNextDayFollowUpJob,
  type FollowUpDog,
  type FollowUpJobDeps,
} from "@/lib/followup/send";

const TEN_AM = new Date("2026-09-23T14:00:00.000Z");

function dog(patch: Partial<FollowUpDog> = {}): FollowUpDog {
  return {
    appointmentId: "apt-1",
    visitId: "33333333-3333-4333-8333-333333333333",
    status: "confirmed",
    serviceEndedAt: "2026-09-22T18:00:00.000Z",
    followupSentAt: null,
    customerId: "cust-1",
    customerEmail: "sarah@example.com",
    customerPhone: "+15615550100",
    customerFirstName: "Sarah",
    petName: "Lychee",
    ...patch,
  };
}

function harness(dogs: FollowUpDog[], options?: { failSms?: boolean }) {
  const marked: string[][] = [];
  const sends: string[] = [];
  const deps: FollowUpJobDeps = {
    now: TEN_AM,
    emailConfigured: true,
    smsConfigured: true,
    loadVisits: async () => [dogs],
    deliver: async (input) => {
      sends.push(input.channel);
      if (options?.failSms && input.channel === "sms") return "failed";
      return "accepted";
    },
    markSent: async (ids) => {
      marked.push(ids);
      return true;
    },
  };
  return { deps, marked, sends };
}

describe("next-day follow-up job", () => {
  it("does not mark sent while a sibling dog is unfinished", async () => {
    const { deps, marked, sends } = harness([
      dog(),
      dog({
        appointmentId: "apt-2",
        petName: "Otto",
        serviceEndedAt: null,
      }),
    ]);
    const result = await runNextDayFollowUpJob(deps);
    assert.equal(result.sent, 0);
    assert.equal(sends.length, 0);
    assert.equal(marked.length, 0);
  });

  it("sends once for the visit after every dog is finished", async () => {
    const { deps, marked, sends } = harness([
      dog(),
      dog({ appointmentId: "apt-2", petName: "Otto" }),
    ]);
    const result = await runNextDayFollowUpJob(deps);
    assert.equal(result.sent, 1);
    assert.deepEqual(sends, ["email", "sms"]);
    assert.deepEqual(marked, [["apt-1", "apt-2"]]);
  });

  it("does not mark sent when one channel can still be retried", async () => {
    const { deps, marked } = harness(
      [dog(), dog({ appointmentId: "apt-2", petName: "Otto" })],
      { failSms: true },
    );
    const result = await runNextDayFollowUpJob(deps);
    assert.equal(result.sent, 0);
    assert.equal(result.failed, 1);
    assert.equal(marked.length, 0);
  });
});

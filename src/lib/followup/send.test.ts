import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { communicationAppointmentScope } from "@/lib/communications/keys";
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
    scope: "visit:33333333-3333-4333-8333-333333333333",
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

  it("sends a historical appointment that has no visit on the next morning", async () => {
    const historical = dog({
      visitId: null,
      scope: communicationAppointmentScope("APT-OLD"),
      appointmentId: "APT-OLD",
    });
    const { deps, marked, sends } = harness([historical]);
    const scopes: Array<string | null> = [];
    deps.deliver = async (input) => {
      scopes.push(input.scope);
      sends.push(input.channel);
      return "accepted";
    };
    const result = await runNextDayFollowUpJob(deps);
    assert.equal(result.sent, 1);
    assert.deepEqual(sends, ["email", "sms"]);
    assert.deepEqual(scopes, [
      "appointment:apt-old",
      "appointment:apt-old",
    ]);
    assert.deepEqual(marked, [["APT-OLD"]]);
  });

  it("does not catch up after the 10:00 window", async () => {
    const { deps, marked, sends } = harness([dog()]);
    deps.now = new Date("2026-09-24T14:00:00.000Z");
    const result = await runNextDayFollowUpJob(deps);
    assert.equal(result.sent, 0);
    assert.equal(sends.length, 0);
    assert.equal(marked.length, 0);
  });

  it("does not send again when the provider result was uncertain", async () => {
    const { deps, marked, sends } = harness([dog()]);
    deps.deliver = async (input) => {
      sends.push(input.channel);
      return input.channel === "sms" ? "uncertain" : "accepted";
    };
    const result = await runNextDayFollowUpJob(deps);
    assert.equal(result.sent, 1);
    assert.deepEqual(sends, ["email", "sms"]);
    assert.equal(marked.length, 1);
  });
});

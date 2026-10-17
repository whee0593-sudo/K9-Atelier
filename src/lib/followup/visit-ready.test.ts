import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { planNextDayFollowUp } from "@/lib/followup/visit-ready";

const done = (id: string, followupSentAt: string | null = null) => ({
  id,
  status: "confirmed",
  serviceEndedAt: "2026-10-16T18:00:00.000Z",
  followupSentAt,
});

describe("next-day follow-up visit gate", () => {
  it("waits while any dog on the visit has not checked out", () => {
    assert.equal(
      planNextDayFollowUp([
        done("a"),
        {
          id: "b",
          status: "confirmed",
          serviceEndedAt: null,
          followupSentAt: null,
        },
      ]),
      "wait",
    );
  });

  it("sends once every remaining dog has checked out", () => {
    assert.equal(planNextDayFollowUp([done("a"), done("b")]), "send");
  });

  it("ignores a cancelled dog and still sends for the dogs who came", () => {
    assert.equal(
      planNextDayFollowUp([
        done("a"),
        {
          id: "b",
          status: "cancelled",
          serviceEndedAt: null,
          followupSentAt: null,
        },
      ]),
      "send",
    );
  });

  it("does not send again after every dog is already marked", () => {
    assert.equal(
      planNextDayFollowUp([done("a", "2026-10-17T14:00:00.000Z")]),
      "skip",
    );
  });
});

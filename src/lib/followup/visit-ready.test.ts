import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  followUpDecision,
  latestCompletionDate,
  planNextDayFollowUp,
  type FollowUpPet,
} from "@/lib/followup/visit-ready";

function pet(
  id: string,
  serviceEndedAt: string | null,
  status = "confirmed",
  followupSentAt: string | null = null,
): FollowUpPet {
  return { id, status, serviceEndedAt, followupSentAt };
}

const TEN_AM_OCT_19 = new Date("2026-10-19T14:00:00.000Z");
const TEN_AM_OCT_20 = new Date("2026-10-20T14:00:00.000Z");
const ELEVEN_AM_OCT_19 = new Date("2026-10-19T15:00:00.000Z");

describe("next-day follow-up visit gate", () => {
  it("waits while any dog on the visit has not checked out", () => {
    assert.equal(
      planNextDayFollowUp(
        [pet("a", "2026-10-16T18:00:00.000Z"), pet("b", null)],
        "2026-10-17",
      ),
      "wait",
    );
  });

  it("uses the later completion date when dogs finish on different days", () => {
    const pets = [
      pet("daisy", "2026-10-16T18:00:00.000Z"),
      pet("milo", "2026-10-18T20:00:00.000Z"),
      pet("cancelled", null, "cancelled"),
    ];
    assert.equal(latestCompletionDate(pets), "2026-10-18");
    assert.equal(planNextDayFollowUp(pets, "2026-10-18"), "wait");
    assert.equal(planNextDayFollowUp(pets, "2026-10-19"), "send");
    assert.equal(followUpDecision(pets, TEN_AM_OCT_19), "send");
  });

  it("does not send after the morning following the last completion", () => {
    const pets = [
      pet("daisy", "2026-10-16T18:00:00.000Z"),
      pet("milo", "2026-10-18T20:00:00.000Z"),
    ];
    assert.equal(planNextDayFollowUp(pets, "2026-10-20"), "missed");
    assert.equal(followUpDecision(pets, TEN_AM_OCT_20), "missed");
    assert.equal(followUpDecision(pets, ELEVEN_AM_OCT_19), "outside_window");
  });

  it("sends a single finished dog on the next morning only", () => {
    const pets = [pet("lychee", "2026-10-16T18:00:00.000Z")];
    assert.equal(latestCompletionDate(pets), "2026-10-16");
    assert.equal(planNextDayFollowUp(pets, "2026-10-17"), "send");
    assert.equal(
      followUpDecision(pets, new Date("2026-10-17T14:00:00.000Z")),
      "send",
    );
    assert.equal(planNextDayFollowUp(pets, "2026-10-18"), "missed");
  });

  it("ignores a cancelled dog and still sends for the dogs who came", () => {
    assert.equal(
      planNextDayFollowUp(
        [
          pet("a", "2026-10-16T18:00:00.000Z"),
          pet("b", null, "cancelled"),
        ],
        "2026-10-17",
      ),
      "send",
    );
  });

  it("does not send again after every dog is already marked", () => {
    assert.equal(
      planNextDayFollowUp(
        [pet("a", "2026-10-16T18:00:00.000Z", "confirmed", "2026-10-17T14:00:00.000Z")],
        "2026-10-17",
      ),
      "skip",
    );
  });
});

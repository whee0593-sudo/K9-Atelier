import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FOLLOW_UP_CLAIM_LEASE_MS,
  followUpClaimOrFilter,
  selectClaimableIds,
} from "./claim";

describe("follow-up claim", () => {
  const now = new Date("2026-08-23T14:30:00.000Z");

  it("builds a PostgREST filter without a dotted timestamp", () => {
    const filter = followUpClaimOrFilter(
      "followup_email_claimed_at",
      new Date(now.getTime() - FOLLOW_UP_CLAIM_LEASE_MS),
    );
    assert.match(
      filter,
      /^followup_email_claimed_at\.is\.null,followup_email_claimed_at\.lt\.[^.]+$/,
    );
    assert.equal(filter.includes(".000"), false);
  });

  it("does not claim a row another worker is holding", () => {
    const leaseBefore = new Date(now.getTime() - FOLLOW_UP_CLAIM_LEASE_MS);
    const claimable = selectClaimableIds(
      [
        {
          id: "daisy",
          sentAt: null,
          claimedAt: now.toISOString(),
        },
      ],
      ["daisy"],
      leaseBefore,
    );
    assert.deepEqual(claimable, []);
  });

  it("can claim again after the lease expires", () => {
    const leaseBefore = new Date(now.getTime() - FOLLOW_UP_CLAIM_LEASE_MS);
    const expired = new Date(leaseBefore.getTime() - 1000).toISOString();
    const claimable = selectClaimableIds(
      [{ id: "daisy", sentAt: null, claimedAt: expired }],
      ["daisy"],
      leaseBefore,
    );
    assert.deepEqual(claimable, ["daisy"]);
  });

  it("does not claim a channel that already sent", () => {
    const claimable = selectClaimableIds(
      [{ id: "daisy", sentAt: now.toISOString(), claimedAt: null }],
      ["daisy"],
      new Date(now.getTime() - FOLLOW_UP_CLAIM_LEASE_MS),
    );
    assert.deepEqual(claimable, []);
  });
});

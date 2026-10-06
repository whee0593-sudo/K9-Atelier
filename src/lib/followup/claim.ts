/** How long a cron may hold a household follow-up before another run may retry it. */
export const FOLLOW_UP_CLAIM_LEASE_MS = 15 * 60 * 1000;

export type FollowUpChannel = "email" | "sms";

export type ChannelClaimSnapshot = {
  id: string;
  sentAt: string | null;
  claimedAt: string | null;
};

export function followUpLeaseBefore(now: Date) {
  return new Date(now.getTime() - FOLLOW_UP_CLAIM_LEASE_MS);
}

/**
 * PostgREST `or` values are split on `.`. Lease stamps used in that filter
 * must not contain a decimal point.
 */
export function followUpClaimOrFilter(
  column: "followup_email_claimed_at" | "followup_sms_claimed_at",
  leaseBefore: Date,
) {
  const stamp = leaseBefore.toISOString().replace(/\.\d{3}Z$/, "Z");
  if (stamp.includes(".")) {
    throw new Error("follow-up claim filter stamp must not contain '.'");
  }
  return `${column}.is.null,${column}.lt.${stamp}`;
}

export function isFreshFollowUpClaim(
  claimedAt: string | null | undefined,
  leaseBefore: Date,
) {
  if (!claimedAt) return false;
  return claimedAt >= leaseBefore.toISOString();
}

/** Ids in `ids` that are unsent and not held by a fresh claim. */
export function selectClaimableIds(
  rows: ChannelClaimSnapshot[],
  ids: string[],
  leaseBefore: Date,
) {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const claimable: string[] = [];
  for (const id of ids) {
    const row = byId.get(id);
    if (!row || row.sentAt) continue;
    if (isFreshFollowUpClaim(row.claimedAt, leaseBefore)) continue;
    claimable.push(id);
  }
  return claimable;
}

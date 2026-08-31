import { NextResponse } from "next/server";
import { mapStaffServiceError, staffJsonError } from "@/lib/staff/api-errors";
import {
  adminAdjustReferralReward,
  adminCancelReferralReward,
  adminReleaseReservation,
  adminResolveReferralRelationship,
  adminReviewReservation,
  getAdminReferralDashboard,
} from "@/lib/referrals/admin";

export async function GET() {
  const result = await getAdminReferralDashboard();
  if ("error" in result) return mapStaffServiceError(result.error);
  return NextResponse.json(result.dashboard);
}

export async function POST(request: Request) {
  let body: {
    action?: string;
    sourceId?: string;
    relationshipId?: string;
    entryId?: string;
    remainingDollars?: number;
    reason?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return staffJsonError("Invalid request.", 400);
  }

  const reason = body.reason ?? "";

  if (body.action === "adjust" && body.sourceId) {
    const result = await adminAdjustReferralReward({
      sourceId: body.sourceId,
      remainingDollars: Number(body.remainingDollars),
      reason,
    });
    if ("error" in result) {
      if (result.error === "conflict") {
        return staffJsonError("Enter a valid remaining amount and a reason.", 400);
      }
      return mapStaffServiceError(result.error);
    }
    return NextResponse.json({ ok: true });
  }

  if (body.action === "cancel" && body.sourceId) {
    const result = await adminCancelReferralReward({
      sourceId: body.sourceId,
      reason,
    });
    if ("error" in result) {
      if (result.error === "conflict") {
        return staffJsonError("A reason is required to cancel a reward.", 400);
      }
      return mapStaffServiceError(result.error);
    }
    return NextResponse.json({ ok: true });
  }

  if (
    (body.action === "approve_relationship" ||
      body.action === "cancel_relationship") &&
    body.relationshipId
  ) {
    const result = await adminResolveReferralRelationship({
      relationshipId: body.relationshipId,
      action: body.action === "approve_relationship" ? "approve" : "cancel",
      reason,
    });
    if ("error" in result) {
      if (result.error === "conflict") {
        return staffJsonError("A reason is required.", 400);
      }
      return mapStaffServiceError(result.error);
    }
    return NextResponse.json({ ok: true });
  }

  if (body.action === "release_reservation" && body.entryId) {
    const result = await adminReleaseReservation({
      entryId: body.entryId,
      reason,
    });
    if ("error" in result) {
      if (result.error === "conflict") {
        return staffJsonError(
          result.message ?? "A reason is required to release a reservation.",
          409,
        );
      }
      return mapStaffServiceError(result.error);
    }
    return NextResponse.json({ ok: true, message: result.message });
  }

  if (body.action === "review_reservation" && body.entryId) {
    const result = await adminReviewReservation({
      entryId: body.entryId,
      reason,
    });
    if ("error" in result) {
      if (result.error === "conflict") {
        return staffJsonError(result.message ?? "A reason is required.", 400);
      }
      return mapStaffServiceError(result.error);
    }
    return NextResponse.json({ ok: true });
  }

  return staffJsonError("Choose a valid referral action.", 400);
}

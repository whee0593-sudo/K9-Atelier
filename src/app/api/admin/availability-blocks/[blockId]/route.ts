import { NextResponse } from "next/server";
import { staffAvailabilityAccessStatus } from "@/lib/appointments/availability-blocks";
import {
  deleteAvailabilityBlock,
  updateAvailabilityBlock,
} from "@/lib/appointments/availability-block-store";
import { getStaffSession } from "@/lib/staff/auth";
import { mapStaffServiceError, staffJsonError } from "@/lib/staff/api-errors";

const BLOCK_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function requireStaff() {
  try {
    return await getStaffSession();
  } catch (error) {
    console.error("availability block auth failed:", error);
    return { error: "unauthenticated" as const };
  }
}

function denyUnlessStaff(
  session: { error: "unauthenticated" | "forbidden" } | { user: unknown },
) {
  const status = staffAvailabilityAccessStatus(session);
  if (status === 401) return mapStaffServiceError("unauthenticated");
  if (status === 403) return mapStaffServiceError("forbidden");
  return null;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ blockId: string }> },
) {
  const session = await requireStaff();
  const denied = denyUnlessStaff(session);
  if (denied) return denied;

  const { blockId } = await context.params;
  if (!BLOCK_ID.test(blockId)) {
    return staffJsonError("Block not found.", 404);
  }

  let body: {
    allDay?: boolean;
    startMinutes?: number | null;
    endMinutes?: number | null;
    reason?: string | null;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return staffJsonError("Invalid request body.", 400);
  }

  const result = await updateAvailabilityBlock(blockId, body);
  if ("error" in result) {
    if (result.error === "invalid") {
      return staffJsonError(result.message ?? "Check the block details.", 400);
    }
    if (result.error === "conflict") {
      return staffJsonError(result.message ?? "That block could not be saved.", 409);
    }
    return mapStaffServiceError(result.error);
  }
  return NextResponse.json({ block: result.block });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ blockId: string }> },
) {
  const session = await requireStaff();
  const denied = denyUnlessStaff(session);
  if (denied) return denied;

  const { blockId } = await context.params;
  if (!BLOCK_ID.test(blockId)) {
    return staffJsonError("Block not found.", 404);
  }

  const result = await deleteAvailabilityBlock(blockId);
  if ("error" in result) {
    if (result.error === "not_found") return mapStaffServiceError("not_found");
    return mapStaffServiceError(
      result.error === "misconfigured" ? "misconfigured" : "server",
    );
  }
  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { staffAvailabilityAccessStatus } from "@/lib/appointments/availability-blocks";
import {
  createAvailabilityBlock,
  loadAvailabilityBlocks,
} from "@/lib/appointments/availability-block-store";
import { getStaffSession } from "@/lib/staff/auth";
import { mapStaffServiceError, staffJsonError } from "@/lib/staff/api-errors";

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

export async function GET(request: Request) {
  const session = await requireStaff();
  const denied = denyUnlessStaff(session);
  if (denied) return denied;

  const url = new URL(request.url);
  const date = url.searchParams.get("date")?.trim() ?? "";
  const from = url.searchParams.get("from")?.trim() || date;
  const to = url.searchParams.get("to")?.trim() || date;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return staffJsonError("Choose a date as YYYY-MM-DD.", 400);
  }

  const result = await loadAvailabilityBlocks(from, to);
  if ("error" in result) {
    return mapStaffServiceError(
      result.error === "misconfigured" ? "misconfigured" : "server",
    );
  }
  return NextResponse.json({ blocks: result.blocks });
}

export async function POST(request: Request) {
  const session = await requireStaff();
  const denied = denyUnlessStaff(session);
  if (denied) return denied;

  let body: {
    date?: string;
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

  const result = await createAvailabilityBlock({
    serviceDate: body.date,
    allDay: body.allDay,
    startMinutes: body.startMinutes,
    endMinutes: body.endMinutes,
    reason: body.reason,
  });
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

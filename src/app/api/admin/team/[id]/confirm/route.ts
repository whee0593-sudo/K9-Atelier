import { NextResponse } from "next/server";
import { mapStaffServiceError, staffJsonError } from "@/lib/staff/api-errors";
import { confirmStaffMember } from "@/lib/staff/team";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  if (!id) return staffJsonError("Record not found.", 404);

  const result = await confirmStaffMember(id);
  if ("error" in result) {
    if (result.error === "forbidden") {
      return staffJsonError("Only the owner can manage admin accounts.", 403);
    }
    return mapStaffServiceError(result.error);
  }
  return NextResponse.json({ ok: true });
}

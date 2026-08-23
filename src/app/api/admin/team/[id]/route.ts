import { NextResponse } from "next/server";
import { mapStaffServiceError, staffJsonError } from "@/lib/staff/api-errors";
import { removeStaffMember } from "@/lib/staff/team";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  if (!id) return staffJsonError("Record not found.", 404);

  const result = await removeStaffMember(id);
  if ("error" in result) {
    if (result.error === "forbidden") {
      return staffJsonError("Only the owner can manage admin accounts.", 403);
    }
    if (result.error === "conflict") {
      return staffJsonError("The owner account cannot be removed.", 409);
    }
    return mapStaffServiceError(result.error);
  }
  return NextResponse.json({ ok: true });
}

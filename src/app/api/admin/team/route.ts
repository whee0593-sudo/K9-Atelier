import { NextResponse } from "next/server";
import { mapStaffServiceError, staffJsonError } from "@/lib/staff/api-errors";
import { inviteStaffMember, listStaffTeam } from "@/lib/staff/team";

export async function GET() {
  const result = await listStaffTeam();
  if ("error" in result) {
    if (result.error === "forbidden") {
      return staffJsonError("Only the owner can manage admin accounts.", 403);
    }
    return mapStaffServiceError(result.error);
  }
  return NextResponse.json(result);
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return staffJsonError("Invalid request body.", 400);
  }

  const email =
    typeof body === "object" &&
    body !== null &&
    "email" in body &&
    typeof body.email === "string"
      ? body.email
      : "";

  const result = await inviteStaffMember(email);
  if ("error" in result) {
    if (result.error === "forbidden") {
      return staffJsonError("Only the owner can manage admin accounts.", 403);
    }
    if (result.error === "conflict") {
      return staffJsonError(
        result.message ?? "That email is already on the admin list.",
        409,
      );
    }
    return mapStaffServiceError(result.error);
  }
  return NextResponse.json(result, { status: 201 });
}

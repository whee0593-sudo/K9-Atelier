import { NextResponse } from "next/server";

export function staffJsonError(
  message: string,
  status: 400 | 401 | 403 | 404 | 409 | 500 | 503,
) {
  return NextResponse.json({ error: message }, { status });
}

export function mapStaffServiceError(
  error:
    | "unauthenticated"
    | "forbidden"
    | "not_found"
    | "server"
    | "conflict"
    | "misconfigured",
) {
  switch (error) {
    case "unauthenticated":
      return staffJsonError("Sign in required.", 401);
    case "forbidden":
      return staffJsonError("Staff access required.", 403);
    case "not_found":
      return staffJsonError("Record not found.", 404);
    case "conflict":
      return staffJsonError("This action is not available for this record.", 409);
    case "misconfigured":
      return staffJsonError("This feature is not configured yet.", 500);
    default:
      return staffJsonError("Something went wrong. Please try again.", 500);
  }
}

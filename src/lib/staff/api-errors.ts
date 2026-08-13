import { NextResponse } from "next/server";

export function staffJsonError(
  message: string,
  status: 400 | 401 | 403 | 404 | 500,
) {
  return NextResponse.json({ error: message }, { status });
}

export function mapStaffServiceError(
  error: "unauthenticated" | "forbidden" | "not_found" | "server",
) {
  switch (error) {
    case "unauthenticated":
      return staffJsonError("Sign in required.", 401);
    case "forbidden":
      return staffJsonError("Staff access required.", 403);
    case "not_found":
      return staffJsonError("Record not found.", 404);
    default:
      return staffJsonError("Something went wrong. Please try again.", 500);
  }
}

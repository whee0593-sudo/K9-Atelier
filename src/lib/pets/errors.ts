import { NextResponse } from "next/server";
import { PetValidationError } from "@/lib/pets/validation";

export type ApiErrorBody = {
  error: string;
  field?: string;
};

export function jsonError(
  message: string,
  status: 400 | 401 | 403 | 404 | 409 | 500 | 502 | 503,
  field?: string,
) {
  const body: ApiErrorBody = field ? { error: message, field } : { error: message };
  return NextResponse.json(body, { status });
}

export function handlePetRouteError(error: unknown) {
  if (error instanceof PetValidationError) {
    const status = error.message === "Pet not found." ? 404 : 400;
    return jsonError(error.message, status, error.field);
  }

  console.error("Pet route error:", error);
  return jsonError("Something went wrong. Please try again.", 500);
}

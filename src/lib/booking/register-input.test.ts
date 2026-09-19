import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ProfileValidationError } from "@/lib/profiles/validation";
import { validateBookingRegisterInput } from "@/lib/booking/register-input";

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    firstName: "Jane",
    lastName: "Miller",
    email: "jane@example.com",
    phone: "5615550123",
    password: "atelier12",
    ...overrides,
  };
}

describe("validateBookingRegisterInput", () => {
  it("normalizes email and phone", () => {
    const input = validateBookingRegisterInput(validBody());
    assert.equal(input.email, "jane@example.com");
    assert.equal(input.phone, "+15615550123");
    assert.equal(input.firstName, "Jane");
  });

  it("rejects a short password", () => {
    assert.throws(
      () => validateBookingRegisterInput(validBody({ password: "short" })),
      (error: unknown) =>
        error instanceof ProfileValidationError && error.field === "password",
    );
  });

  it("rejects an invalid email", () => {
    assert.throws(
      () => validateBookingRegisterInput(validBody({ email: "not-an-email" })),
      ProfileValidationError,
    );
  });
});

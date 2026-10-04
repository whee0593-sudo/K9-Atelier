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
    referralSource: "google",
    ...overrides,
  };
}

describe("validateBookingRegisterInput", () => {
  it("normalizes email and phone", () => {
    const input = validateBookingRegisterInput(validBody());
    assert.equal(input.email, "jane@example.com");
    assert.equal(input.phone, "+15615550123");
    assert.equal(input.firstName, "Jane");
    assert.equal(input.referralSource, "google");
    assert.equal(input.referralName, null);
  });

  it("keeps optional referral name only for referral source", () => {
    const input = validateBookingRegisterInput(
      validBody({
        referralSource: "referral",
        referralName: "  Alex  ",
      }),
    );
    assert.equal(input.referralSource, "referral");
    assert.equal(input.referralName, "Alex");
  });

  it("rejects a missing referral source", () => {
    assert.throws(
      () => validateBookingRegisterInput(validBody({ referralSource: "" })),
      (error: unknown) =>
        error instanceof ProfileValidationError &&
        error.field === "referralSource",
    );
  });

  it("rejects a free-text referral source", () => {
    assert.throws(
      () =>
        validateBookingRegisterInput(
          validBody({ referralSource: "A flyer at the park" }),
        ),
      (error: unknown) =>
        error instanceof ProfileValidationError &&
        error.field === "referralSource",
    );
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

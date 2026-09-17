import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CUSTOMER_ADMIN_NOTES_MAX_LENGTH,
  ProfileValidationError,
  validateCustomerAdminNotes,
} from "@/lib/profiles/validation";

describe("validateCustomerAdminNotes", () => {
  it("accepts an empty record as a blank note", () => {
    assert.equal(validateCustomerAdminNotes({ notes: "" }), "");
    assert.equal(validateCustomerAdminNotes({}), "");
    assert.equal(validateCustomerAdminNotes({ notes: null }), "");
  });

  it("keeps staff-only customer notes exactly as typed", () => {
    assert.equal(
      validateCustomerAdminNotes({ notes: "Prefers side-door entry." }),
      "Prefers side-door entry.",
    );
  });

  it("rejects notes that are too long", () => {
    assert.throws(
      () =>
        validateCustomerAdminNotes({
          notes: "x".repeat(CUSTOMER_ADMIN_NOTES_MAX_LENGTH + 1),
        }),
      (error: unknown) =>
        error instanceof ProfileValidationError &&
        error.message === "Notes are too long.",
    );
  });

  it("rejects a non-object body", () => {
    assert.throws(
      () => validateCustomerAdminNotes("notes"),
      (error: unknown) =>
        error instanceof ProfileValidationError &&
        error.message === "Invalid request body.",
    );
  });
});

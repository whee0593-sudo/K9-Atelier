import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  ProfileValidationError,
  validateStaffAddressRewriteInput,
} from "@/lib/profiles/validation";

describe("staff service address rewrite", () => {
  it("accepts a complete from/to address pair", () => {
    const input = validateStaffAddressRewriteInput({
      from: {
        street: "2100 S Ocean Blvd",
        city: "Palm Beach",
        state: "FL",
        zip: "33480",
      },
      to: {
        street: "100 Olive Ave",
        city: "West Palm Beach",
        state: "FL",
        zip: "33401",
      },
    });
    assert.equal(input.to.street, "100 Olive Ave");
    assert.equal(input.from.zip, "33480");
  });

  it("rejects a blank destination street", () => {
    assert.throws(
      () =>
        validateStaffAddressRewriteInput({
          from: {
            street: "2100 S Ocean Blvd",
            city: "Palm Beach",
            state: "FL",
            zip: "33480",
          },
          to: {
            street: "  ",
            city: "West Palm Beach",
            state: "FL",
            zip: "33401",
          },
        }),
      (error: unknown) =>
        error instanceof ProfileValidationError &&
        error.message === "Street is required.",
    );
  });

  it("exposes a staff API that rewrites visit addresses", () => {
    const service = readFileSync(
      new URL("./staff-addresses.ts", import.meta.url),
      "utf8",
    );
    assert.match(service, /export async function rewriteStaffCustomerServiceAddress/);
    const route = readFileSync(
      new URL("../../app/api/admin/customers/[customerId]/addresses/route.ts", import.meta.url),
      "utf8",
    );
    assert.match(route, /rewriteStaffCustomerServiceAddress/);
  });
});

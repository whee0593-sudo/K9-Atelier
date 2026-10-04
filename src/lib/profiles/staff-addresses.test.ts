import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  ProfileValidationError,
  validateStaffAddressCreateInput,
  validateStaffAddressRewriteInput,
} from "@/lib/profiles/validation";

describe("staff service addresses", () => {
  it("accepts a complete address for create", () => {
    const input = validateStaffAddressCreateInput({
      street: "100 Olive Ave",
      city: "West Palm Beach",
      state: "FL",
      zip: "33401",
    });
    assert.equal(input.street, "100 Olive Ave");
    assert.equal(input.zip, "33401");
  });

  it("accepts nested address objects for create", () => {
    const input = validateStaffAddressCreateInput({
      address: {
        street: "100 Olive Ave",
        city: "West Palm Beach",
        state: "FL",
        zip: "33401",
      },
    });
    assert.equal(input.city, "West Palm Beach");
  });

  it("rejects a blank destination street on rewrite", () => {
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

  it("exposes staff list/add/rewrite helpers and API routes", () => {
    const service = readFileSync(
      new URL("./staff-addresses.ts", import.meta.url),
      "utf8",
    );
    assert.match(service, /export async function listStaffCustomerServiceAddresses/);
    assert.match(service, /export async function addStaffCustomerServiceAddress/);
    assert.match(service, /export async function rewriteStaffCustomerServiceAddress/);
    assert.match(service, /customer_service_addresses/);

    const route = readFileSync(
      new URL(
        "../../app/api/admin/customers/[customerId]/addresses/route.ts",
        import.meta.url,
      ),
      "utf8",
    );
    assert.match(route, /export async function GET/);
    assert.match(route, /export async function POST/);
    assert.match(route, /export async function PATCH/);
    assert.match(route, /addStaffCustomerServiceAddress/);
    assert.match(route, /rewriteStaffCustomerServiceAddress/);
  });
});

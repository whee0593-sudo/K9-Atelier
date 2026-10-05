import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  mapBookingProfile,
  orderBookingAddresses,
  resolveBookingProfileQuery,
  type BookingAddressStamp,
} from "@/lib/staff/customer-booking-profile";

function address(
  street: string,
  createdAt: string,
  extras: Partial<BookingAddressStamp> = {},
): BookingAddressStamp {
  return {
    street,
    city: "Palm Beach",
    state: "FL",
    zip: "33480",
    createdAt,
    ...extras,
  };
}

describe("orderBookingAddresses", () => {
  it("uses the newest visit address ahead of older saved addresses", () => {
    const ordered = orderBookingAddresses(
      [address("10 Saved St", "2026-01-01T00:00:00.000Z")],
      [
        address("20 Old Visit", "2026-02-01T00:00:00.000Z"),
        address("30 New Visit", "2026-03-01T00:00:00.000Z"),
      ],
    );
    assert.deepEqual(
      ordered.map((entry) => entry.street),
      ["30 New Visit", "10 Saved St", "20 Old Visit"],
    );
  });

  it("falls back to the newest saved address when the customer has no visits", () => {
    const ordered = orderBookingAddresses(
      [
        address("10 Older", "2026-01-01T00:00:00.000Z"),
        address("20 Newer", "2026-04-01T00:00:00.000Z"),
      ],
      [],
    );
    assert.deepEqual(
      ordered.map((entry) => entry.street),
      ["20 Newer", "10 Older"],
    );
  });

  it("keeps one entry when a visit repeats a saved address", () => {
    const ordered = orderBookingAddresses(
      [address("10 Main", "2026-01-01T00:00:00.000Z", { zip: "33480" })],
      [address("10 Main", "2026-05-01T00:00:00.000Z", { zip: "33480" })],
    );
    assert.equal(ordered.length, 1);
    assert.equal(ordered[0]?.street, "10 Main");
  });
});

describe("mapBookingProfile", () => {
  it("keeps active pets and drops a blank pet row", () => {
    const profile = mapBookingProfile({
      profile: {
        id: "11111111-1111-4111-8111-111111111111",
        email: "jose@example.com",
        first_name: "Jose",
        last_name: "Perez",
        phone: "+15613520356",
      },
      pets: [
        {
          id: "22222222-2222-4222-8222-222222222222",
          name: "Luna",
          breed: "Poodle",
          weight_lbs: "14.5",
        },
        {
          id: "33333333-3333-4333-8333-333333333333",
          name: " ",
          breed: "",
          weight_lbs: 0,
        },
      ],
      savedAddresses: [address("10 Main", "2026-01-01T00:00:00.000Z")],
      visitAddresses: [],
    });
    assert.equal(profile.pets.length, 1);
    assert.equal(profile.pets[0]?.name, "Luna");
    assert.equal(profile.pets[0]?.weightLbs, 14.5);
    assert.equal(profile.addresses[0]?.street, "10 Main");
    assert.equal(profile.firstName, "Jose");
  });
});

describe("resolveBookingProfileQuery", () => {
  it("loads the linked customer file until contact details change", () => {
    const query = resolveBookingProfileQuery({
      email: "jose@example.com",
      phone: "+15613520356",
      prefillCustomerId: "11111111-1111-4111-8111-111111111111",
      prefillEmail: "jose@example.com",
      prefillPhone: "5613520356",
    });
    assert.deepEqual(query, {
      customerId: "11111111-1111-4111-8111-111111111111",
    });
  });

  it("looks up a typed email once it no longer matches the linked file", () => {
    const query = resolveBookingProfileQuery({
      email: "ada@example.com",
      phone: "+15613520356",
      prefillCustomerId: "11111111-1111-4111-8111-111111111111",
      prefillEmail: "jose@example.com",
      prefillPhone: "+15613520356",
    });
    assert.deepEqual(query, { email: "ada@example.com" });
  });

  it("waits until a phone number is long enough to search", () => {
    assert.equal(
      resolveBookingProfileQuery({
        email: "",
        phone: "561",
      }),
      null,
    );
  });
});

describe("customer booking profile route", () => {
  it("exposes a staff lookup for saved pets and addresses", () => {
    const route = readFileSync(
      new URL(
        "../../app/api/admin/customer-booking-profile/route.ts",
        import.meta.url,
      ),
      "utf8",
    );
    assert.match(route, /export async function GET/);
    assert.match(route, /lookupStaffBookingProfile/);

    const service = readFileSync(
      new URL("./lookup-booking-profile.ts", import.meta.url),
      "utf8",
    );
    assert.match(service, /customer_service_addresses/);
    assert.match(service, /\.from\("pets"\)/);
    assert.match(service, /archived_at/);
  });
});

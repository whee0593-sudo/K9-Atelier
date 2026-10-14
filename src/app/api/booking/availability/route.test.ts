import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { GET, POST } from "@/app/api/booking/availability/route";
import { resolveAvailabilityDuration } from "@/lib/booking/availability-request";
import { bookingDurationMinutes } from "@/lib/booking-flow";
import { WEIGHT_REQUIRED_MESSAGE } from "@/lib/pets/weight";
import { clearRateLimitStore } from "@/lib/rate-limit";

const BATH = "signature-bath-care";

before(() => {
  clearRateLimitStore();
});

function availabilityGet(weight: string | null, ip: string, extra?: Record<string, string>) {
  const params = new URLSearchParams({
    lat: "26.8",
    lon: "-80.05",
    zip: "33401",
    serviceId: BATH,
    ...extra,
  });
  if (weight != null) params.set("weightLbs", weight);
  return new Request(`http://localhost/api/booking/availability?${params}`, {
    headers: { "x-forwarded-for": ip },
  });
}

describe("availability weight gate", () => {
  it("rejects an unusable weight before scheduling", async () => {
    const cases: Array<string | null> = [null, "", "0", "-3", "NaN", "201", "250"];
    for (const [index, weight] of cases.entries()) {
      const response = await GET(availabilityGet(weight, `203.0.113.${index + 1}`));
      const body = (await response.json()) as {
        error?: string;
        field?: string;
        days?: unknown;
      };
      assert.equal(response.status, 400, String(weight));
      assert.equal(body.error, WEIGHT_REQUIRED_MESSAGE);
      assert.equal(body.field, "weightLbs");
      assert.equal(body.days, undefined);
    }
  });

  it("does not accept a duration override in place of a valid weight", async () => {
    const response = await GET(
      availabilityGet("0", "203.0.113.20", { durationMinutes: "90" }),
    );
    const body = (await response.json()) as { error?: string; days?: unknown };
    assert.equal(response.status, 400);
    assert.equal(body.error, WEIGHT_REQUIRED_MESSAGE);
    assert.equal(body.days, undefined);
  });

  it("keeps the existing duration for a valid weight", () => {
    for (const weight of [12, 18, 45, 200, "14.5"]) {
      const parsed = typeof weight === "number" ? weight : 14.5;
      assert.deepEqual(
        resolveAvailabilityDuration({
          serviceId: BATH,
          weightLbs: weight,
          addOnIds: [],
        }),
        { durationMinutes: bookingDurationMinutes(BATH, parsed, []) },
      );
    }
    assert.notEqual(
      bookingDurationMinutes(BATH, 12, []),
      bookingDurationMinutes(BATH, 20, []),
    );
    assert.deepEqual(
      resolveAvailabilityDuration({
        serviceId: BATH,
        weightLbs: 18,
        addOnIds: ["dematting-brush-out"],
        durationOverride: 90,
      }),
      { durationMinutes: 90 },
    );
    assert.deepEqual(
      resolveAvailabilityDuration({
        serviceId: "",
        weightLbs: 18,
        addOnIds: [],
      }),
      { durationMinutes: bookingDurationMinutes(null, 18, []) },
    );
    for (const weight of [null, undefined, "", 0, -3, Number.NaN, 201]) {
      assert.deepEqual(
        resolveAvailabilityDuration({
          serviceId: BATH,
          weightLbs: weight,
          addOnIds: [],
          durationOverride: 90,
        }),
        { error: "weight_required" },
      );
    }
  });

  it("still asks for the address when a valid weight has no location", async () => {
    const params = new URLSearchParams({
      serviceId: BATH,
      weightLbs: "18",
    });
    const response = await GET(
      new Request(`http://localhost/api/booking/availability?${params}`, {
        headers: { "x-forwarded-for": "203.0.113.30" },
      }),
    );
    const body = (await response.json()) as { error?: string; field?: string };
    assert.equal(response.status, 400);
    assert.equal(body.error, "Address details are required.");
    assert.equal(body.field, undefined);
  });
});

describe("availability assignment weight gate", () => {
  it("rejects an unusable weight before assigning a slot", async () => {
    const weights: unknown[] = [undefined, null, 0, -3, Number.NaN, 201, 250];
    for (const [index, weightLbs] of weights.entries()) {
      const response = await POST(
        new Request("http://localhost/api/booking/availability", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-forwarded-for": `203.0.113.${40 + index}`,
          },
          body: JSON.stringify({
            lat: 26.8,
            lon: -80.05,
            zip: "33401",
            serviceId: BATH,
            date: "2026-11-02",
            slotStartMinutes: 9 * 60,
            weightLbs,
          }),
        }),
      );
      const body = (await response.json()) as {
        error?: string;
        field?: string;
        appointmentTime?: string;
      };
      assert.equal(response.status, 400, String(weightLbs));
      assert.equal(body.error, WEIGHT_REQUIRED_MESSAGE);
      assert.equal(body.field, "weightLbs");
      assert.equal(body.appointmentTime, undefined);
    }
  });

  it("still asks for the date when a valid weight is incomplete", async () => {
    const response = await POST(
      new Request("http://localhost/api/booking/availability", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": "203.0.113.60",
        },
        body: JSON.stringify({
          lat: 26.8,
          lon: -80.05,
          zip: "33401",
          serviceId: BATH,
          weightLbs: 18,
          slotStartMinutes: 9 * 60,
        }),
      }),
    );
    const body = (await response.json()) as { error?: string; field?: string };
    assert.equal(response.status, 400);
    assert.equal(body.error, "Date, start time, and address are required.");
    assert.equal(body.field, undefined);
  });
});

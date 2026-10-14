import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AppointmentRecord } from "@/lib/appointments/types";
import { catalogChargeItems } from "@/lib/charges/catalog";
import { buildDefaultLineItems } from "@/lib/charges/line-items";
import { catalogLinePatch } from "@/lib/charges/list-amount";
import { mapPetRowToRecord } from "@/lib/pets/map";
import type { PetRow } from "@/lib/pets/types";
import {
  bookingWeightLbs,
  liveServiceDurationMinutes,
  readStoredWeightLbs,
} from "@/lib/pets/weight";
import { validateStaffCustomerCreateInput } from "@/lib/profiles/validation";
import { estimateServiceDurationMinutes } from "@/lib/services";
import { resolveAppointmentDuration } from "@/lib/visits/duration";

const BATH = "signature-bath-care";

function petRow(weight: PetRow["weight_lbs"]): PetRow {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    customer_id: "22222222-2222-4222-8222-222222222222",
    name: "Milo",
    breed: "Poodle",
    weight_lbs: weight,
    date_of_birth: null,
    approximate_age_years: null,
    sex: null,
    temperament_notes: null,
    health_comfort_notes: null,
    grooming_preferences: null,
    archived_at: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}

function appointment(): AppointmentRecord {
  return {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    customerId: "22222222-2222-4222-8222-222222222222",
    petId: "11111111-1111-4111-8111-111111111111",
    petName: "Milo",
    petBreed: "Poodle",
    serviceId: BATH,
    serviceName: "Signature Bath & Care",
    addOnIds: ["dematting-brush-out"],
    addOnOptions: {},
    addressStreet: "1 Main",
    addressCity: "West Palm Beach",
    addressState: "FL",
    addressZip: "33401",
    travelDistanceMiles: 4,
    travelFee: 0,
    appointmentDate: "2026-11-02",
    appointmentTime: "9:00 AM",
    scheduledStart: 540,
    timePreference: "morning",
    timezone: "America/New_York",
    estimatedTotal: 140,
    newClientDeposit: null,
    vaccinationStatusAtBooking: null,
    status: "confirmed",
    confirmedAt: null,
    customerConfirmedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("stored pet weight", () => {
  it("keeps a null database weight null", () => {
    assert.equal(readStoredWeightLbs(null), null);
    assert.equal(readStoredWeightLbs(undefined), null);
    assert.equal(mapPetRowToRecord(petRow(null)).weightLbs, null);
  });

  it("keeps a real weight and does not treat a numeric string as missing", () => {
    assert.equal(readStoredWeightLbs(18), 18);
    assert.equal(readStoredWeightLbs("14.5"), 14.5);
    assert.equal(mapPetRowToRecord(petRow("14.5")).weightLbs, 14.5);
  });
});

describe("booking weight gate", () => {
  it("rejects null, zero, negative, NaN, and over 200 lbs", () => {
    for (const value of [null, undefined, "", 0, -3, Number.NaN, 201, 250]) {
      assert.equal(bookingWeightLbs(value), null, String(value));
    }
  });

  it("accepts a weight inside the existing tiers", () => {
    assert.equal(bookingWeightLbs(18), 18);
    assert.equal(bookingWeightLbs(45), 45);
    assert.equal(bookingWeightLbs(200), 200);
  });
});

describe("duration without a saved snapshot", () => {
  it("uses the real tier for a valid weight and does not substitute 20 lbs", () => {
    const at18 = liveServiceDurationMinutes(BATH, 18, []);
    const at20 = estimateServiceDurationMinutes(BATH, 20, []);
    const at12 = estimateServiceDurationMinutes(BATH, 12, []);
    assert.equal(at18, estimateServiceDurationMinutes(BATH, 18, []));
    assert.notEqual(at18, at12);
    assert.equal(at18, at20);
    assert.equal(liveServiceDurationMinutes(BATH, null, []), null);
    assert.equal(liveServiceDurationMinutes(BATH, 0, []), null);
    assert.equal(liveServiceDurationMinutes(BATH, -1, []), null);
    assert.equal(liveServiceDurationMinutes(BATH, 250, []), null);
  });

  it("keeps a saved duration when the live weight estimate is unavailable", () => {
    const decision = resolveAppointmentDuration({
      storedMinutes: 90,
      status: "confirmed",
      appointmentDate: "2099-01-04",
      liveEstimateMinutes: liveServiceDurationMinutes(BATH, null, []) ?? 0,
      today: "2099-01-01",
    });
    assert.equal(decision.unknown, false);
    if (!decision.unknown) {
      assert.equal(decision.minutes, 90);
      assert.equal(decision.persistLiveEstimate, false);
    }
  });
});

describe("checkout quotes", () => {
  it("does not suggest the under-15 price when weight is missing", () => {
    const missing = catalogChargeItems(null).find((item) => item.id === BATH);
    const small = catalogChargeItems(12).find((item) => item.id === BATH);
    const mid = catalogChargeItems(20).find((item) => item.id === BATH);
    assert.equal(missing?.suggestedAmount, null);
    assert.equal(small?.suggestedAmount, 90);
    assert.equal(mid?.suggestedAmount, 110);
    const lines = buildDefaultLineItems(appointment(), null);
    assert.equal(
      lines.some((item) => item.amount === 90 || item.catalogId === BATH),
      false,
    );
    const patch = catalogLinePatch({
      id: BATH,
      name: "Signature Bath & Care",
      suggestedAmount: null,
    });
    assert.equal(patch.amount, undefined);
  });
});

describe("staff customer file", () => {
  it("lets staff file a dog without a weight", () => {
    const input = validateStaffCustomerCreateInput({
      pet: { name: "Milo" },
    });
    assert.equal(input.pet?.name, "Milo");
    assert.equal(input.pet?.weightLbs, null);
    assert.equal(bookingWeightLbs(input.pet?.weightLbs), null);
  });
});

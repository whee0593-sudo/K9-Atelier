import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { nextIdempotencyKey } from "@/lib/booking-intent";
import {
  ADDRESS_UNVERIFIED_MESSAGE,
  resolveGuestDrivingQuote,
} from "@/lib/booking-distance";
import { confirmationEstimateLabel, evaluateSubmittedBookingPrice } from "@/lib/booking-price";
import type { AppointmentRecord } from "@/lib/appointments/types";
import {
  guestBookingIntentHash,
  insertGuestBooking,
} from "@/lib/appointments/guest-booking";
import { buildCustomerAppointmentConfirmedEmail } from "@/lib/email/html-templates";
import { calculateTravelFee, type ServiceAddress } from "@/lib/travel";

const address: ServiceAddress = {
  street: "100 Olive Ave",
  city: "West Palm Beach",
  state: "FL",
  zip: "33401",
};

const base = { lat: 26.8, lon: -80.08 };
const customer = { lat: 26.72, lon: -80.05 };

function deps(miles: number | null, geocodeFails = false) {
  return {
    baseAddress: "1408 N Killian Dr, Lake Park, FL 33403",
    geocode: async (query: string) => {
      if (geocodeFails) return null;
      return query.includes("Killian") ? base : customer;
    },
    distance: async () => miles,
  };
}

describe("measured driving distance", () => {
  it("rejects a forged short mileage and returns the measured quote", async () => {
    const measured = await resolveGuestDrivingQuote(address, deps(12));
    assert.equal(measured.ok, true);
    if (!measured.ok) return;
    assert.equal(measured.distanceMiles, 12);
    assert.equal(measured.travel.fee, 13);
    assert.deepEqual(measured.point, customer);

    const priced = evaluateSubmittedBookingPrice(
      {
        serviceId: "signature-bath-care",
        addOnIds: [],
        addOnOptions: {},
        distanceMiles: measured.distanceMiles,
        estimatedTotal: 90,
      },
      12,
    );
    assert.equal(priced.ok, false);
    if (priced.ok) return;
    assert.equal(priced.code, "price_changed");
    assert.equal(priced.quote?.travelFee, 13);
    assert.equal(priced.quote?.estimatedTotal, 103);
  });

  it("rejects an address beyond 25 miles", async () => {
    const measured = await resolveGuestDrivingQuote(address, deps(25.01));
    assert.equal(measured.ok, false);
    if (measured.ok) return;
    assert.equal(measured.code, "outside_area");
    assert.equal(measured.message.includes("Killian"), false);
    assert.equal(measured.message.includes("API"), false);
  });

  it("rejects a failed geocode or distance without using a caller mileage", async () => {
    const geocode = await resolveGuestDrivingQuote(address, deps(4, true));
    const distance = await resolveGuestDrivingQuote(address, deps(null));
    assert.equal(geocode.ok, false);
    assert.equal(distance.ok, false);
    if (!geocode.ok) assert.equal(geocode.message, ADDRESS_UNVERIFIED_MESSAGE);
    if (!distance.ok) assert.equal(distance.code, "address_unverified");
    const source = readFileSync(new URL("./booking-distance.ts", import.meta.url), "utf8");
    assert.equal(source.includes("travelDistanceMiles"), false);
    assert.equal(source.includes("travelFee"), false);
  });

  it("keeps 10, 20, and 25 mile fees on the unrounded distance", async () => {
    const cases = [
      { miles: 10, fee: 0, bookable: true },
      { miles: 10.04, fee: 0, bookable: true },
      { miles: 10.06, fee: 0, bookable: true },
      { miles: 10.08, fee: 1, bookable: true },
      { miles: 20, fee: 65, bookable: true },
      { miles: 20.04, fee: 65, bookable: true },
      { miles: 25, fee: 115, bookable: true },
      { miles: 25.01, fee: 0, bookable: false },
    ];
    for (const item of cases) {
      const measured = await resolveGuestDrivingQuote(address, deps(item.miles));
      const fee = calculateTravelFee(item.miles);
      assert.equal(fee.fee, item.fee);
      assert.equal(fee.withinServiceArea, item.bookable);
      assert.equal(measured.ok, item.bookable);
      if (!measured.ok || !item.bookable) continue;
      assert.equal(measured.distanceMiles, item.miles);
      assert.equal(measured.travel.fee, item.fee);
    }
    assert.equal(calculateTravelFee(10.1).fee, 1);
  });

  it("accepts a resubmitted total that matches the measured quote", () => {
    const priced = evaluateSubmittedBookingPrice(
      {
        serviceId: "signature-bath-care",
        addOnIds: [],
        addOnOptions: {},
        distanceMiles: 12,
        estimatedTotal: 103,
      },
      12,
    );
    assert.equal(priced.ok, true);
  });
});

describe("booking intent key", () => {
  it("reuses a key for the same intent and mints a new one when the intent changes", () => {
    const first = nextIdempotencyKey(null, "bath|olive|600", () => "key-a");
    const retry = nextIdempotencyKey(first, "bath|olive|600", () => "key-b");
    const changed = nextIdempotencyKey(retry, "groom|olive|600", () => "key-c");
    assert.equal(retry.key, "key-a");
    assert.equal(changed.key, "key-c");
  });

  it("changes the payload hash when the appointment contents change", () => {
    const baseIntent = {
      petId: "11111111-1111-4111-8111-111111111111",
      serviceId: "signature-bath-care",
      addOnIds: [],
      addOnOptions: {},
      address,
      appointmentDate: "2026-10-20",
      slotStartMinutes: 600,
      paymentMethodId: "22222222-2222-4222-8222-222222222222",
    };
    const same = guestBookingIntentHash(baseIntent);
    const again = guestBookingIntentHash({ ...baseIntent, addOnIds: [] });
    const other = guestBookingIntentHash({
      ...baseIntent,
      serviceId: "custom-full-haircut",
    });
    assert.equal(same, again);
    assert.notEqual(same, other);
  });
});

function confirmedAppointment(
  patch: Partial<AppointmentRecord>,
): AppointmentRecord {
  return {
    id: "apt-1",
    customerId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    petId: "11111111-1111-4111-8111-111111111111",
    petName: "Bella",
    petBreed: "Shih Tzu",
    serviceId: "hand-stripping",
    serviceName: "Hand Stripping",
    addOnIds: [],
    addOnOptions: {},
    addressStreet: "100 Olive Ave",
    addressCity: "West Palm Beach",
    addressState: "FL",
    addressZip: "33401",
    travelDistanceMiles: 4,
    travelFee: 0,
    appointmentDate: "2026-10-20",
    appointmentTime: "10:00 AM",
    scheduledStart: 600,
    timePreference: "morning",
    timezone: "America/New_York",
    estimatedTotal: 160,
    newClientDeposit: null,
    vaccinationStatusAtBooking: null,
    status: "confirmed",
    confirmedAt: "2026-10-15T12:00:00.000Z",
    customerConfirmedAt: null,
    createdAt: "2026-10-15T12:00:00.000Z",
    ...patch,
  };
}

describe("hand stripping confirmation copy", () => {
  it("labels the hourly rate as an estimate rather than a fixed total", () => {
    assert.equal(confirmationEstimateLabel("hand-stripping", 160, 0), "From $160/hour");
    assert.equal(
      confirmationEstimateLabel("hand-stripping", 173, 13),
      "From $173 (from $160/hour)",
    );
    assert.equal(confirmationEstimateLabel("signature-bath-care", 90, 0), null);
    const email = buildCustomerAppointmentConfirmedEmail(
      confirmedAppointment({}),
      { email: "tia@example.com", name: "Tia" },
    );
    assert.match(email.html, /From \$160\/hour/);
    assert.match(email.text, /From \$160\/hour/);
    assert.equal(email.html.includes(">$160/hour<"), false);
    assert.equal(email.text.includes("\n$160/hour"), false);
    const withTravel = buildCustomerAppointmentConfirmedEmail(
      confirmedAppointment({ travelFee: 13, estimatedTotal: 173, travelDistanceMiles: 12 }),
      { email: "tia@example.com", name: "Tia" },
    );
    assert.match(withTravel.html, /From \$173 \(from \$160\/hour\)/);
    assert.match(withTravel.text, /From \$173 \(from \$160\/hour\)/);
  });
});

describe("idempotency result mapping", () => {
  const input = {
    idempotencyKey: "33333333-3333-4333-8333-333333333333",
    payloadHash: "hash",
    visit: {},
    appointment: {},
  };

  it("returns the original appointment on replay and does not invent a new id", async () => {
    const replay = await insertGuestBooking(
      {
        rpc: async () => ({
          data: {
            created: false,
            appointment_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          },
          error: null,
        }),
      },
      input,
    );
    assert.deepEqual(replay, {
      created: false,
      appointmentId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    });
  });

  it("rejects the same key with different contents without returning the old appointment", async () => {
    const mismatch = await insertGuestBooking(
      {
        rpc: async () => ({
          data: null,
          error: { message: "idempotency_mismatch" },
        }),
      },
      input,
    );
    assert.deepEqual(mismatch, { error: "idempotency_mismatch" });
  });
});

describe("recalculated quote reaches the confirm screen", () => {
  it("replaces the displayed total with the server quote and resubmits that total", () => {
    const confirm = readFileSync(
      new URL("../components/booking/BookingConfirmStep.tsx", import.meta.url),
      "utf8",
    );
    const flow = readFileSync(
      new URL("../components/booking/BookingFlow.tsx", import.meta.url),
      "utf8",
    );
    assert.match(confirm, /setServerQuote\(submitError\.quote\)/);
    assert.match(confirm, /estimatedTotal: quoted\.quote\.estimatedTotal/);
    assert.match(flow, /nextIdempotencyKey\(current, bookingIntent/);
    assert.equal(flow.includes("travelQuote.distanceMiles"), true);
    const intentAt = flow.indexOf("const bookingIntent");
    const intentEnd = flow.indexOf("useEffect", intentAt);
    const intent = flow.slice(intentAt, intentEnd);
    assert.equal(intent.includes("travelQuote"), false);
    assert.equal(intent.includes("estimatedTotal"), false);
  });
});

describe("unchanged booking neighbors", () => {
  it("leaves Stripe setup and staff booking on their existing paths", () => {
    const stripe = readFileSync(
      new URL("./payments/service.ts", import.meta.url),
      "utf8",
    );
    const card = readFileSync(
      new URL("../components/account/PaymentMethodsManager.tsx", import.meta.url),
      "utf8",
    );
    const staff = readFileSync(
      new URL("./staff/create-customer-booking.ts", import.meta.url),
      "utf8",
    );
    const breed = readFileSync(
      new URL("../../content/account-fields.json", import.meta.url),
      "utf8",
    );
    assert.match(stripe, /usage: "off_session"/);
    assert.match(stripe, /allow_redirects: "never"/);
    assert.match(card, /stripe\.confirmSetup\(/);
    assert.equal(staff.includes("create_guest_booking"), false);
    assert.match(breed, /"placeholder": "e\.g\., Shih Tzu"/);
  });
});

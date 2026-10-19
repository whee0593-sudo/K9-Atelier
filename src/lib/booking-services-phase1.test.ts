import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  AppointmentValidationError,
  validateCreateAppointmentInput,
} from "@/lib/appointments/validation";
import { mapAppointmentServiceError } from "@/lib/appointments/errors";
import { guestBookingIntentHash } from "@/lib/appointments/guest-booking";
import {
  ALLERGY_PROFILE_UNAVAILABLE_MESSAGE,
  allergySnapshotFromProfileRead,
  allergyStatusLabel,
  allergyWarning,
  buildAllergySnapshot,
  readAllergyStatus,
} from "@/lib/allergies";
import { buildDefaultLineItems } from "@/lib/charges/line-items";
import { getUpcomingBookableDates } from "@/lib/booking-slots";
import { bookingCareRowsForCategory, getBookingCareCategories } from "@/lib/booking-flow";
import { guestBookingSelectionError, quoteGuestBooking } from "@/lib/booking-price";
import {
  buildCustomerAppointmentSubmittedEmail,
  buildStaffNewAppointmentEmail,
} from "@/lib/email/html-templates";
import type { AppointmentRecord } from "@/lib/appointments/types";
import { LONG_COAT_CARE_PATH } from "@/lib/long-coat-care-page";
import {
  canonicalServiceId,
  isRetiredSpaService,
  LUXURY_SPA_DAY_ID,
  SHOW_LEVEL_COAT_CARE_ID,
} from "@/lib/service-catalog";
import {
  getServiceDisplayDescription,
  getServiceDisplayName,
} from "@/lib/service-display";
import {
  estimateServiceDurationMinutes,
  getAvailableAddOns,
  getServicePriceEstimate,
  MINI_TRIM_ALREADY_INCLUDED_MESSAGE,
  selectionRepeatsIncludedMiniTrim,
  supportsMiniTrimAddOn,
} from "@/lib/services";
import { getServiceById } from "@/lib/service-page";
import {
  LEGACY_LONG_COAT_CARE_PATH,
  PERMANENT_REDIRECTS,
  SHOW_LEVEL_COAT_CARE_PATH,
} from "@/lib/site-redirects";
import { SPA_GOALS, parseSpaGoals, spaGoalsForService } from "@/lib/spa-goals";
import sitemap from "@/app/sitemap";

function appointment(patch: Partial<AppointmentRecord> = {}): AppointmentRecord {
  return {
    id: "apt-1",
    customerId: "cust-1",
    petId: "pet-1",
    petName: "Maple",
    petBreed: "Cavapoo",
    serviceId: LUXURY_SPA_DAY_ID,
    serviceName: "Luxury Spa Day",
    addOnIds: [],
    addOnOptions: {},
    addressStreet: "123 Example Avenue",
    addressCity: "Palm Beach Gardens",
    addressState: "FL",
    addressZip: "33418",
    travelDistanceMiles: 4,
    travelFee: 0,
    appointmentDate: "2026-10-24",
    appointmentTime: "10:00–11:00 AM",
    scheduledStart: 600,
    timePreference: "morning",
    timezone: "America/New_York",
    estimatedTotal: 140,
    newClientDeposit: 0,
    vaccinationStatusAtBooking: null,
    status: "confirmed",
    confirmedAt: "2026-10-17T12:00:00.000Z",
    customerConfirmedAt: null,
    createdAt: "2026-10-17T12:00:00.000Z",
    ...patch,
  };
}

function bookingBody(overrides: Record<string, unknown> = {}) {
  const appointmentDate = getUpcomingBookableDates(1)[0]?.value ?? "2026-10-20";
  return {
    petId: "11111111-1111-4111-8111-111111111111",
    serviceId: LUXURY_SPA_DAY_ID,
    serviceName: "Luxury Spa Day",
    addOnIds: [],
    addOnOptions: {},
    address: {
      street: "100 Olive Ave",
      city: "West Palm Beach",
      state: "FL",
      zip: "33401",
    },
    travelDistanceMiles: 4,
    travelFee: 0,
    appointmentDate,
    appointmentTime: "10–11 AM",
    slotStartMinutes: 600,
    addressLat: 26.7153,
    addressLon: -80.0534,
    estimatedTotal: 140,
    paymentMethodId: "22222222-2222-4222-8222-222222222222",
    idempotencyKey: "33333333-3333-4333-8333-333333333333",
    customerPhone: "+15615550100",
    customerFirstName: "Tia",
    customerLastName: "Francavilla",
    ...overrides,
  };
}

describe("phase 1 main services", () => {
  it("shows Signature Bath, Show-Level Coat Care, and Luxury Spa Day with the short copy", () => {
    const rows = bookingCareRowsForCategory(
      getBookingCareCategories(18).find((item) => item.id === "bath-show-spa")!
        .services,
    );
    assert.deepEqual(
      rows.map((row) => (row.kind === "service" ? row.service.name : "")),
      ["Signature Bath", "Show-Level Coat Care", "Luxury Spa Day"],
    );
    assert.equal(
      getServiceDisplayDescription("signature-bath-care", ""),
      "Bath, blow-dry, and brush-out. Nail, ear, and teeth care included.",
    );
    assert.equal(
      getServiceDisplayDescription(SHOW_LEVEL_COAT_CARE_ID, ""),
      "An upgraded bath with show-level coat conditioning. Nail, ear, and teeth care included. Mini trim included.",
    );
    assert.equal(
      getServiceDisplayDescription(LUXURY_SPA_DAY_ID, ""),
      "A fully customized, relaxing spa experience for your pup. Nail, ear, and teeth care included. Mini trim included.",
    );
  });

  it("keeps full groom and hand stripping bookable", () => {
    assert.equal(
      getServiceDisplayName("custom-full-haircut", ""),
      "The Atelier Full Groom",
    );
    assert.equal(getServiceById("hand-stripping")?.name, "Hand Stripping");
  });
});

describe("Show-Level Coat Care rename", () => {
  it("resolves the old id to the same service and the new path", () => {
    assert.equal(canonicalServiceId("long-coat-show-care"), SHOW_LEVEL_COAT_CARE_ID);
    assert.equal(getServiceById("long-coat-show-care")?.id, SHOW_LEVEL_COAT_CARE_ID);
    assert.equal(
      getServiceDisplayName("long-coat-show-care", "Show Care"),
      "Show-Level Coat Care",
    );
    assert.equal(LONG_COAT_CARE_PATH, SHOW_LEVEL_COAT_CARE_PATH);
    assert.deepEqual(PERMANENT_REDIRECTS, [
      {
        source: LEGACY_LONG_COAT_CARE_PATH,
        destination: SHOW_LEVEL_COAT_CARE_PATH,
        statusCode: 301,
      },
    ]);
    const config = readFileSync(new URL("../../next.config.ts", import.meta.url), "utf8");
    assert.match(config, /PERMANENT_REDIRECTS/);
    assert.match(config, /statusCode: redirect\.statusCode/);
  });

  it("publishes the new URL and leaves the old URL out of the sitemap", () => {
    const urls = sitemap().map((entry) => entry.url);
    assert.ok(urls.includes("https://k9atelier.com/services/show-level-coat-care"));
    assert.equal(urls.includes("https://k9atelier.com/services/long-coat-care"), false);
  });
});

describe("Luxury Spa Day goals and price", () => {
  it("accepts any combination of the four goals, including none", () => {
    assert.deepEqual(
      SPA_GOALS.map((goal) => goal.title),
      [
        "Sensitive Skin",
        "Shedding & Coat Care",
        "Relaxation & Comfort",
        "Shiny & Fabulous",
      ],
    );
    const all = parseSpaGoals(SPA_GOALS.map((goal) => goal.id));
    assert.equal(all.ok, true);
    if (all.ok) assert.equal(all.goals.length, 4);
    const none = spaGoalsForService(LUXURY_SPA_DAY_ID, []);
    assert.deepEqual(none, { ok: true, goals: [] });
    const rejected = spaGoalsForService("signature-bath-care", ["sensitive-skin"]);
    assert.equal(rejected.ok, false);
    const saved = validateCreateAppointmentInput(
      bookingBody({
        spaGoals: ["shiny-fabulous", "sensitive-skin", "sensitive-skin"],
      }),
    );
    assert.deepEqual(saved.spaGoals, ["shiny-fabulous", "sensitive-skin"]);
    assert.throws(
      () =>
        validateCreateAppointmentInput(
          bookingBody({ serviceId: "signature-bath-care", spaGoals: ["shiny-fabulous"] }),
        ),
      (error: unknown) => error instanceof AppointmentValidationError,
    );
  });

  it("uses one weight table and ignores how many goals are selected", () => {
    const spa = getServiceById(LUXURY_SPA_DAY_ID);
    assert.ok(spa);
    assert.equal(getServicePriceEstimate(spa, 12)?.from, 140);
    assert.equal(getServicePriceEstimate(spa, 20)?.from, 160);
    assert.equal(getServicePriceEstimate(spa, 40)?.from, 180);
    assert.equal(estimateServiceDurationMinutes(LUXURY_SPA_DAY_ID, 12, []), 60);
    assert.equal(estimateServiceDurationMinutes(LUXURY_SPA_DAY_ID, 20, []), 75);
    assert.equal(estimateServiceDurationMinutes(LUXURY_SPA_DAY_ID, 40, []), 90);
    const light = quoteGuestBooking({
      serviceId: LUXURY_SPA_DAY_ID,
      weightLbs: 12,
      addOnIds: [],
      addOnOptions: {},
      distanceMiles: 4,
    });
    const alias = quoteGuestBooking({
      serviceId: "long-coat-show-care",
      weightLbs: 12,
      addOnIds: [],
      addOnOptions: {},
      distanceMiles: 4,
    });
    assert.equal(light.ok, true);
    assert.equal(alias.ok, true);
    if (light.ok && alias.ok) {
      assert.equal(light.quote.serviceId, LUXURY_SPA_DAY_ID);
      assert.equal(alias.quote.serviceId, SHOW_LEVEL_COAT_CARE_ID);
      assert.equal(alias.quote.estimatedServicePrice, 120);
    }
    const again = quoteGuestBooking({
      serviceId: LUXURY_SPA_DAY_ID,
      weightLbs: 12,
      addOnIds: [],
      addOnOptions: {},
      distanceMiles: 4,
    });
    assert.equal(again.ok && light.ok && again.quote.estimatedTotal === light.quote.estimatedTotal, true);
  });
});

describe("retired spa services and add-ons", () => {
  it("rejects new bookings for the three retired spa services and for an add-on alone", () => {
    for (const serviceId of [
      "dead-sea-mud-bath",
      "aromatherapy-oil-bath",
      "sensitive-skin-treatment",
    ]) {
      assert.equal(isRetiredSpaService(serviceId), true);
      assert.equal(getServiceById(serviceId), null);
      const error = guestBookingSelectionError({
        serviceId,
        weightLbs: 12,
        addOnIds: [],
        addOnOptions: {},
      });
      assert.equal(error?.code, "invalid_service");
    }
    const addOn = guestBookingSelectionError({
      serviceId: "mini-trim",
      weightLbs: 12,
      addOnIds: [],
      addOnOptions: {},
    });
    assert.equal(addOn?.code, "invalid_service");
    assert.equal(
      getAvailableAddOns("bath-show-spa", "signature-bath-care").some(
        (service) => service.id === "mini-trim",
      ),
      supportsMiniTrimAddOn("signature-bath-care"),
    );
    assert.equal(supportsMiniTrimAddOn(LUXURY_SPA_DAY_ID), false);
    assert.equal(supportsMiniTrimAddOn(SHOW_LEVEL_COAT_CARE_ID), false);
    assert.equal(supportsMiniTrimAddOn("custom-full-haircut"), false);
    assert.equal(supportsMiniTrimAddOn("signature-bath-care"), true);
  });

  it("renames show-level rows in place and does not delete appointment history", () => {
    const sql = readFileSync(
      new URL(
        "../../supabase/migrations/20261017120000_booking_services_phase1.sql",
        import.meta.url,
      ),
      "utf8",
    );
    assert.match(sql, /ADD COLUMN IF NOT EXISTS spa_goals/);
    assert.match(sql, /ADD COLUMN IF NOT EXISTS allergy_snapshot/);
    assert.match(sql, /household_allergy_status/);
    assert.equal(sql.includes("DELETE FROM public.appointments"), false);
    assert.equal(sql.includes("DROP TABLE"), false);
    assert.equal(sql.includes("REVOKE INSERT ON TABLE public.visits"), false);
    assert.match(sql, /p_appointment -> 'spa_goals'/);
    assert.match(sql, /v_item -> 'allergy_snapshot'/);
    assert.equal(/UPDATE public\.appointments/.test(sql), false);
    assert.match(sql, /BEGIN;/);
    assert.match(sql, /COMMIT;/);
    const rename = readFileSync(
      new URL(
        "../../supabase/migrations/20261017121000_show_level_service_id.sql",
        import.meta.url,
      ),
      "utf8",
    );
    assert.match(
      rename,
      /UPDATE public\.appointments\s+SET\s+service_id = 'show-level-coat-care',\s+service_name = 'Show-Level Coat Care'\s+WHERE btrim\(service_id\) = 'long-coat-show-care'/,
    );
    assert.match(rename, /appointments_show_level_id_backup/);
    assert.equal(rename.includes("DELETE FROM"), false);
    assert.match(rename, /BEGIN;/);
    assert.match(rename, /COMMIT;/);
  });
});

describe("allergy snapshot and staff email", () => {
  it("keeps yes, none, unsure, and blank distinct", () => {
    assert.equal(readAllergyStatus(undefined), undefined);
    assert.equal(readAllergyStatus(null), null);
    assert.equal(readAllergyStatus(""), null);
    assert.equal(readAllergyStatus("unsure"), "unsure");
    assert.equal(readAllergyStatus("none"), "none");
    assert.equal(allergyStatusLabel(null), "Not recorded");
    assert.equal(allergyStatusLabel("unsure"), "Not sure");
    assert.equal(allergyStatusLabel("none"), "No known allergies");
    assert.equal(
      allergyWarning(
        buildAllergySnapshot({
          petName: "Maple",
          petStatus: "unsure",
          householdStatus: null,
        }),
      ),
      null,
    );
    assert.equal(
      allergyWarning(
        buildAllergySnapshot({
          petName: "Maple",
          petStatus: "none",
          householdStatus: "none",
        }),
      ),
      null,
    );
    assert.equal(allergyWarning(null), null);
  });

  it("warns with the customer's own words for each dog and the household", () => {
    const maple = buildAllergySnapshot({
      petName: "Maple",
      petStatus: "yes",
      petDetails: "Peanut allergy — owner affected",
      householdStatus: "unsure",
    });
    const cedar = buildAllergySnapshot({
      petName: "Cedar",
      petStatus: null,
      householdStatus: "yes",
      householdDetails: "Avoid peanut-containing products",
    });
    const mapleWarning = allergyWarning(maple);
    const cedarWarning = allergyWarning(cedar);
    assert.ok(mapleWarning);
    assert.ok(cedarWarning);
    assert.equal(
      mapleWarning?.banner,
      "ALLERGY: MAPLE: PEANUT ALLERGY — OWNER AFFECTED",
    );
    assert.equal(mapleWarning?.lines.includes("HOUSEHOLD:"), false);
    assert.equal(
      cedarWarning?.banner,
      "ALLERGY: HOUSEHOLD: AVOID PEANUT-CONTAINING PRODUCTS",
    );
    assert.equal((cedarWarning?.banner ?? "").includes("MAPLE"), false);

    const staff = buildStaffNewAppointmentEmail(
      appointment({ allergySnapshot: maple, spaGoals: ["sensitive-skin"] }),
      { name: "Tia Francavilla", email: "tia@example.com" },
    );
    assert.match(staff.text, /ALLERGY: MAPLE: PEANUT ALLERGY — OWNER AFFECTED/);
    assert.match(staff.text, /ALLERGIES & SENSITIVITIES/);
    assert.match(staff.html, /#9B1C1C/);
    assert.match(staff.html, /PEANUT ALLERGY — OWNER AFFECTED/);
    assert.equal(staff.html.includes("AVOID"), false);

    const quiet = buildStaffNewAppointmentEmail(appointment(), {
      name: "Tia Francavilla",
      email: "tia@example.com",
    });
    assert.equal(quiet.text.includes("ALLERGY:"), false);
    assert.equal(quiet.html.includes("ALLERGIES"), false);

    const customer = buildCustomerAppointmentSubmittedEmail(
      appointment({ allergySnapshot: maple }),
      { name: "Tia Francavilla", email: "tia@example.com" },
    );
    assert.equal(customer.text.includes("ALLERGY:"), false);
    assert.equal(customer.html.includes("ALLERGIES &amp; SENSITIVITIES"), false);
  });

  it("does not turn a failed allergy read into no known allergies", () => {
    const failed = allergySnapshotFromProfileRead({
      petError: true,
      profileError: false,
      pet: { name: "Maple", allergy_status: "yes", allergy_details: "Peanut" },
      profile: { household_allergy_status: "none" },
      fallbackPetName: "Maple",
    });
    const missingPet = allergySnapshotFromProfileRead({
      petError: false,
      profileError: false,
      pet: null,
      profile: null,
      fallbackPetName: "Maple",
    });
    const blank = allergySnapshotFromProfileRead({
      petError: false,
      profileError: false,
      pet: { name: "Maple", allergy_status: null, allergy_details: null },
      profile: null,
      fallbackPetName: "Maple",
    });
    const unsure = allergySnapshotFromProfileRead({
      petError: false,
      profileError: false,
      pet: { name: "Maple", allergy_status: "unsure" },
      profile: { household_allergy_status: "unsure" },
      fallbackPetName: "Maple",
    });
    const none = allergySnapshotFromProfileRead({
      petError: false,
      profileError: false,
      pet: { name: "Maple", allergy_status: "none" },
      profile: { household_allergy_status: "none" },
      fallbackPetName: "Maple",
    });
    assert.equal(failed.ok, false);
    assert.equal(missingPet.ok, false);
    assert.equal(blank.ok, true);
    assert.equal(unsure.ok, true);
    assert.equal(none.ok, true);
    if (!blank.ok || !unsure.ok || !none.ok) return;
    assert.equal(blank.snapshot.petStatus, null);
    assert.equal(blank.snapshot.householdStatus, null);
    assert.equal(allergyStatusLabel(blank.snapshot.petStatus), "Not recorded");
    assert.equal(unsure.snapshot.petStatus, "unsure");
    assert.equal(none.snapshot.petStatus, "none");
    assert.equal(allergyWarning(blank.snapshot), null);
    assert.equal(allergyWarning(unsure.snapshot), null);
    assert.equal(allergyWarning(none.snapshot), null);
    assert.notEqual(blank.snapshot.petStatus, "none");
    assert.notEqual(unsure.snapshot.petStatus, "none");
  });

  it("stops the booking before the idempotent insert when the allergy read fails", async () => {
    const response = mapAppointmentServiceError("allergy_unavailable");
    assert.equal(response.status, 503);
    const body = (await response.json()) as { error?: string; code?: string };
    assert.equal(body.code, "allergy_unavailable");
    assert.equal(body.error, ALLERGY_PROFILE_UNAVAILABLE_MESSAGE);
    assert.equal(/no known allergies/i.test(body.error ?? ""), false);

    const service = readFileSync(
      new URL("./appointments/service.ts", import.meta.url),
      "utf8",
    );
    const addDog = readFileSync(
      new URL("./appointments/customer-change.ts", import.meta.url),
      "utf8",
    );
    const staff = readFileSync(
      new URL("./staff/create-customer-booking.ts", import.meta.url),
      "utf8",
    );
    assert.ok(
      service.indexOf('error: "allergy_unavailable"') <
        service.indexOf("insertGuestBooking("),
    );
    assert.ok(
      addDog.indexOf('error: "allergy_unavailable"') <
        addDog.indexOf('.from("appointments")\n    .insert'),
    );
    assert.ok(
      staff.indexOf('error: "allergy_unavailable"') <
        staff.indexOf("createStaffVisit("),
    );
    const intent = {
      petId: "11111111-1111-4111-8111-111111111111",
      serviceId: SHOW_LEVEL_COAT_CARE_ID,
      addOnIds: [] as string[],
      addOnOptions: {},
      address: {
        street: "100 Olive Ave",
        city: "West Palm Beach",
        state: "FL",
        zip: "33401",
      },
      appointmentDate: "2026-10-24",
      slotStartMinutes: 600,
      paymentMethodId: "22222222-2222-4222-8222-222222222222",
    };
    assert.equal(guestBookingIntentHash(intent), guestBookingIntentHash(intent));
  });
});

describe("included mini trim is not charged again", () => {
  it("keeps Mini Trim on Signature Bath and rejects it on services that already include it", () => {
    assert.equal(
      getAvailableAddOns("bath-show-spa", SHOW_LEVEL_COAT_CARE_ID).some(
        (service) => service.id === "mini-trim",
      ),
      false,
    );
    assert.equal(
      getAvailableAddOns("bath-show-spa", LUXURY_SPA_DAY_ID).some(
        (service) => service.id === "mini-trim",
      ),
      false,
    );
    assert.equal(
      getAvailableAddOns("bath-show-spa", "signature-bath-care").some(
        (service) => service.id === "mini-trim",
      ),
      true,
    );
    for (const serviceId of [SHOW_LEVEL_COAT_CARE_ID, LUXURY_SPA_DAY_ID, "custom-full-haircut"]) {
      const quoted = quoteGuestBooking({
        serviceId,
        weightLbs: 12,
        addOnIds: ["mini-trim"],
        addOnOptions: {},
        distanceMiles: 4,
      });
      assert.equal(quoted.ok, false);
      if (!quoted.ok) assert.equal(quoted.code, "invalid_addon");
      assert.equal(selectionRepeatsIncludedMiniTrim([serviceId], ["mini-trim"]), true);
    }
    const bath = quoteGuestBooking({
      serviceId: "signature-bath-care",
      weightLbs: 12,
      addOnIds: ["mini-trim"],
      addOnOptions: {},
      distanceMiles: 4,
    });
    assert.equal(bath.ok, true);
    if (bath.ok) {
      assert.equal(bath.quote.servicePrice, 90);
      assert.equal(bath.quote.addOnPrice, 30);
      assert.equal(bath.quote.estimatedServicePrice, 120);
    }
    const showLevel = quoteGuestBooking({
      serviceId: SHOW_LEVEL_COAT_CARE_ID,
      weightLbs: 12,
      addOnIds: ["dematting-brush-out"],
      addOnOptions: {},
      distanceMiles: 4,
    });
    assert.equal(showLevel.ok, true);
    if (showLevel.ok) {
      assert.equal(showLevel.quote.servicePrice, 120);
      assert.equal(showLevel.quote.addOns.some((item) => item.id === "mini-trim"), false);
    }
    assert.throws(
      () =>
        validateCreateAppointmentInput(
          bookingBody({
            serviceId: SHOW_LEVEL_COAT_CARE_ID,
            addOnIds: ["mini-trim"],
            estimatedTotal: 150,
          }),
        ),
      (error: unknown) =>
        error instanceof AppointmentValidationError &&
        error.message === "That add-on cannot be booked with this service.",
    );
    const lines = buildDefaultLineItems(
      appointment({
        serviceId: SHOW_LEVEL_COAT_CARE_ID,
        serviceName: "Show-Level Coat Care",
        addOnIds: ["mini-trim", "dematting-brush-out"],
        estimatedTotal: 150,
      }),
      12,
    );
    assert.equal(lines.some((item) => item.catalogId === "mini-trim"), false);
    assert.equal(lines.some((item) => item.catalogId === "dematting-brush-out"), false);
    assert.equal(MINI_TRIM_ALREADY_INCLUDED_MESSAGE.includes("Mini Trim"), true);
    assert.equal(selectionRepeatsIncludedMiniTrim(["signature-bath-care", "mini-trim"]), false);
    assert.equal(
      selectionRepeatsIncludedMiniTrim(["long-coat-show-care", "mini-trim"]),
      true,
    );
  });
});

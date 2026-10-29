import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BOOKING_STEPS,
  DEFAULT_AVAILABILITY_SERVICE_ID,
  bookingCareChoicesForService,
  bookingCareRowsForCategory,
  bookingDurationMinutes,
  createDraftBookingPet,
  getBookingCareCategories,
  guestCreativeOptionNotice,
  isPersistedPetId,
  nextExpandedCareCategoryId,
} from "@/lib/booking-flow";
import {
  CUSTOM_CREATIVE_DESIGN_GUEST_MESSAGE,
  estimateServiceDurationMinutes,
} from "@/lib/services";

describe("booking flow helpers", () => {
  it("defines six public booking steps in the requested order", () => {
    assert.deepEqual(
      BOOKING_STEPS.map((step) => step.short),
      ["About Your Pup", "Service", "Date & Time", "About You", "Secure Your Appointment", "Confirm"],
    );
  });

  it("uses the signature bath duration when no service is chosen yet", () => {
    assert.equal(
      bookingDurationMinutes(null, 18),
      estimateServiceDurationMinutes(DEFAULT_AVAILABILITY_SERVICE_ID, 18),
    );
    assert.equal(
      bookingDurationMinutes("  ", 18, ["dematting-brush-out"]),
      estimateServiceDurationMinutes(
        DEFAULT_AVAILABILITY_SERVICE_ID,
        18,
        ["dematting-brush-out"],
      ),
    );
  });

  it("creates a draft pet that is not persisted", () => {
    const pet = createDraftBookingPet();
    assert.equal(isPersistedPetId(pet.id), false);
    assert.match(pet.id, /^draft-/);
  });

  it("recognizes a saved pet uuid", () => {
    assert.equal(isPersistedPetId("2f1c3a10-7c4e-4b5a-9d2e-1a2b3c4d5e6f"), true);
    assert.equal(isPersistedPetId("draft-1"), false);
  });

  it("groups primary services and specialty add-on information into four categories", () => {
    const categories = getBookingCareCategories(18);
    assert.deepEqual(
      categories.map((category) => category.id),
      ["bath-show-spa", "full-grooming", "creative-accent-coloring", "specialty-add-on-care"],
    );
    assert.equal(
      categories.some((category) => category.id === "add-on-care"),
      false,
    );
  });

  it("keeps the same four categories when the guest is signed in", () => {
    const categories = getBookingCareCategories(18, { includeMembersOnly: true });
    assert.deepEqual(
      categories.map((category) => category.id),
      [
        "bath-show-spa",
        "full-grooming",
        "creative-accent-coloring",
        "specialty-add-on-care",
      ],
    );
  });

  it("limits over-45 guest care to the hand-stripping category", () => {
    const categories = getBookingCareCategories(50);
    assert.deepEqual(
      categories.map((category) => category.id),
      ["full-grooming"],
    );
    assert.deepEqual(
      categories.find((category) => category.id === "full-grooming")?.services.map(
        (service) => service.id,
      ),
      ["hand-stripping"],
    );
  });

  it("lists Signature Bath, Show-Level Coat Care, and Luxury Spa Day in order", () => {
    const category = getBookingCareCategories(18).find(
      (item) => item.id === "bath-show-spa",
    );
    assert.ok(category);
    const rows = bookingCareRowsForCategory(category.services);
    assert.deepEqual(
      rows.map((row) => (row.kind === "service" ? row.service.id : row.kind)),
      ["signature-bath-care", "show-level-coat-care", "luxury-spa-day"],
    );
    assert.equal(
      rows.some((row) => row.kind === "spa-group"),
      false,
    );
  });

  it("lists every creative coloring option instead of the first price only", () => {
    const category = getBookingCareCategories(18).find(
      (item) => item.id === "creative-accent-coloring",
    );
    assert.ok(category);
    const choices = category.services.flatMap((service) =>
      bookingCareChoicesForService(service),
    );
    assert.deepEqual(
      choices.map((choice) => choice.title),
      [
        "Temporary Fun",
        "Ears & Tail Accent",
        "Paws & Boots Accent",
        "Custom Creative Design",
      ],
    );
    assert.equal(choices[0]?.priceLabel, "From $50");
    assert.equal(choices[1]?.priceLabel, "From $100 / section");
    assert.equal(choices[2]?.priceLabel, "From $350");
    assert.equal(choices[3]?.priceLabel, "Consultation required");
    assert.equal(
      guestCreativeOptionNotice("Custom Creative Design"),
      CUSTOM_CREATIVE_DESIGN_GUEST_MESSAGE,
    );
    assert.equal(guestCreativeOptionNotice("Temporary Fun"), null);
  });

  it("toggles a care category open and closed", () => {
    assert.equal(nextExpandedCareCategoryId(null, "bath-show-spa"), "bath-show-spa");
    assert.equal(
      nextExpandedCareCategoryId("bath-show-spa", "bath-show-spa"),
      null,
    );
    assert.equal(
      nextExpandedCareCategoryId("bath-show-spa", "full-grooming"),
      "full-grooming",
    );
  });
});

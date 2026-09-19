import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BOOKING_STEPS,
  DEFAULT_AVAILABILITY_SERVICE_ID,
  bookingCareChoicesForService,
  bookingDurationMinutes,
  createDraftBookingPet,
  getBookingCareCategories,
  isPersistedPetId,
  nextExpandedCareCategoryId,
} from "@/lib/booking-flow";
import { estimateServiceDurationMinutes } from "@/lib/services";

describe("booking flow helpers", () => {
  it("defines six public booking steps in the requested order", () => {
    assert.deepEqual(
      BOOKING_STEPS.map((step) => step.short),
      ["Your Dog", "Date & Time", "Care", "Your Details", "Payment", "Confirm"],
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

  it("groups bookable care into categories and hides add-on-only groups", () => {
    const categories = getBookingCareCategories(18);
    assert.deepEqual(
      categories.map((category) => category.id),
      ["bath-show-spa", "full-grooming", "creative-accent-coloring"],
    );
    assert.equal(
      categories.some((category) => category.id === "add-on-care"),
      false,
    );
  });

  it("shows members-only end-of-life care when the guest is signed in", () => {
    const categories = getBookingCareCategories(18, { includeMembersOnly: true });
    assert.deepEqual(
      categories.map((category) => category.id),
      [
        "bath-show-spa",
        "full-grooming",
        "creative-accent-coloring",
        "end-of-life-care",
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

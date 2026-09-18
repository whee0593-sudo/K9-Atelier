import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BOOKING_STEPS,
  DEFAULT_AVAILABILITY_SERVICE_ID,
  bookingDurationMinutes,
  createDraftBookingPet,
  isPersistedPetId,
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
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sanitizeAuthRedirect } from "@/lib/auth-redirect";
import {
  ACCOUNT_SETUP_PATH,
  paymentSetupHref,
  petNeedsVaccinationRecord,
  petToExpandForSetup,
  petsSetupHref,
} from "@/lib/account-setup";
import type { PetProfile } from "@/lib/pets";

function pet(overrides: Partial<PetProfile>): PetProfile {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Bella",
    breed: "Poodle",
    weightLbs: 18,
    vaccineRecordUploaded: false,
    vaccinationBookingStatus: "missing",
    ...overrides,
  };
}

describe("account setup helpers", () => {
  it("builds setup links for pets and payment", () => {
    assert.equal(petsSetupHref("abc"), "/account/pets?setup=1&pet=abc");
    assert.equal(paymentSetupHref(), "/account/payment?setup=1");
  });

  it("expands the requested pet, then a pet still missing a record", () => {
    const ready = pet({
      id: "22222222-2222-4222-8222-222222222222",
      name: "Coco",
      vaccineRecordUploaded: true,
      vaccinationBookingStatus: "current",
    });
    const missing = pet({ name: "Bella" });
    assert.equal(petNeedsVaccinationRecord(missing), true);
    assert.equal(petNeedsVaccinationRecord(ready), false);
    assert.equal(petToExpandForSetup([ready, missing], ready.id), ready.id);
    assert.equal(petToExpandForSetup([ready, missing], null), missing.id);
  });

  it("allows the setup page as a post-login redirect", () => {
    assert.equal(sanitizeAuthRedirect(ACCOUNT_SETUP_PATH), ACCOUNT_SETUP_PATH);
  });
});

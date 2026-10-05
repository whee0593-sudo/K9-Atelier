import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mapPetRowToRecord, mapPetProfileToWriteInput, mapPetRecordToUiProfile, mapValidatedInputToInsertRow, mapValidatedInputToUpdateRow } from "@/lib/pets/map";
import type { PetRow } from "@/lib/pets/types";
import {
  PetValidationError,
  validateCreatePetInput,
  validatePetId,
  validateUpdatePetInput,
} from "@/lib/pets/validation";

const validCreate = {
  name: "  Bella  ",
  breed: " Shih Tzu ",
  weightLbs: 12,
  dateOfBirth: "2017-05-18",
  sex: "Female, Spayed",
  temperamentNotes: " Gentle ",
};

describe("validateCreatePetInput", () => {
  it("accepts valid create input and normalizes whitespace", () => {
    const input = validateCreatePetInput(validCreate);
    assert.equal(input.name, "Bella");
    assert.equal(input.breed, "Shih Tzu");
    assert.equal(input.weightLbs, 12);
    assert.equal(input.dateOfBirth, "2017-05-18");
    assert.equal(input.sex, "Female, Spayed");
    assert.equal(input.temperamentNotes, "Gentle");
    assert.equal(input.rabiesStatus, null);
  });

  it("accepts a confirmed rabies status", () => {
    const input = validateCreatePetInput({
      ...validCreate,
      rabiesStatus: "current",
    });
    assert.equal(input.rabiesStatus, "current");
  });

  it("keeps a record expiration date on create", () => {
    const input = validateCreatePetInput({
      ...validCreate,
      rabiesExpirationDate: "2027-06-15",
    });
    assert.equal(input.rabiesExpirationDate, "2027-06-15");
  });

  it("rejects an invalid record expiration date", () => {
    assert.throws(
      () =>
        validateCreatePetInput({
          ...validCreate,
          rabiesExpirationDate: "06/15/2027",
        }),
      (error: unknown) =>
        error instanceof PetValidationError &&
        error.field === "rabiesExpirationDate",
    );
  });

  it("rejects an invalid rabies status", () => {
    assert.throws(
      () => validateCreatePetInput({ ...validCreate, rabiesStatus: "expired" }),
      (error: unknown) =>
        error instanceof PetValidationError && error.field === "rabiesStatus",
    );
  });

  it("rejects missing name", () => {
    assert.throws(
      () => validateCreatePetInput({ ...validCreate, name: "   " }),
      (error: unknown) =>
        error instanceof PetValidationError && error.field === "name",
    );
  });

  it("rejects missing breed", () => {
    assert.throws(
      () => validateCreatePetInput({ ...validCreate, breed: "" }),
      (error: unknown) =>
        error instanceof PetValidationError && error.field === "breed",
    );
  });

  it("rejects zero weight", () => {
    assert.throws(
      () => validateCreatePetInput({ ...validCreate, weightLbs: 0 }),
      (error: unknown) =>
        error instanceof PetValidationError && error.field === "weightLbs",
    );
  });

  it("rejects negative weight", () => {
    assert.throws(
      () => validateCreatePetInput({ ...validCreate, weightLbs: -3 }),
      (error: unknown) =>
        error instanceof PetValidationError && error.field === "weightLbs",
    );
  });

  it("rejects unrealistic weight", () => {
    assert.throws(
      () => validateCreatePetInput({ ...validCreate, weightLbs: 250 }),
      (error: unknown) =>
        error instanceof PetValidationError && error.field === "weightLbs",
    );
  });

  it("rejects future date of birth", () => {
    assert.throws(
      () =>
        validateCreatePetInput({
          ...validCreate,
          dateOfBirth: "2099-01-01",
        }),
      (error: unknown) =>
        error instanceof PetValidationError && error.field === "dateOfBirth",
    );
  });

  it("rejects dob and approximate age together", () => {
    assert.throws(
      () =>
        validateCreatePetInput({
          name: "Max",
          breed: "Poodle",
          weightLbs: 10,
          dateOfBirth: "2020-01-01",
          approximateAgeYears: 4,
        }),
      (error: unknown) => error instanceof PetValidationError,
    );
  });

  it("rejects invalid approximate age", () => {
    assert.throws(
      () =>
        validateCreatePetInput({
          name: "Max",
          breed: "Poodle",
          weightLbs: 10,
          approximateAgeYears: 0,
        }),
      (error: unknown) =>
        error instanceof PetValidationError &&
        error.field === "approximateAgeYears",
    );
  });

  it("rejects unknown fields", () => {
    assert.throws(
      () =>
        validateCreatePetInput({
          ...validCreate,
          customerId: "evil",
        }),
      (error: unknown) =>
        error instanceof PetValidationError && error.field === "customerId",
    );
  });
});

describe("validateUpdatePetInput", () => {
  it("accepts partial updates", () => {
    const input = validateUpdatePetInput({ name: "  Coco  " });
    assert.equal(input.name, "Coco");
  });

  it("accepts a record expiration date on its own", () => {
    const input = validateUpdatePetInput({ rabiesExpirationDate: "2027-06-15" });
    assert.equal(input.rabiesExpirationDate, "2027-06-15");
  });

  it("clears a record expiration date", () => {
    const input = validateUpdatePetInput({ rabiesExpirationDate: "" });
    assert.equal(input.rabiesExpirationDate, null);
  });

  it("rejects empty update payloads", () => {
    assert.throws(
      () => validateUpdatePetInput({}),
      (error: unknown) => error instanceof PetValidationError,
    );
  });
});

describe("validatePetId", () => {
  it("accepts uuid ids", () => {
    assert.equal(
      validatePetId("11111111-1111-4111-8111-111111111111"),
      "11111111-1111-4111-8111-111111111111",
    );
  });

  it("rejects invalid ids", () => {
    assert.throws(
      () => validatePetId("not-a-uuid"),
      (error: unknown) => error instanceof PetValidationError,
    );
  });
});

describe("mapPetRowToRecord", () => {
  it("maps database rows to camelCase records", () => {
    const row: PetRow = {
      id: "11111111-1111-4111-8111-111111111111",
      customer_id: "22222222-2222-4222-8222-222222222222",
      name: "Bella",
      breed: "Shih Tzu",
      weight_lbs: 12,
      date_of_birth: "2017-05-18",
      approximate_age_years: null,
      sex: "Female, Spayed",
      temperament_notes: "Calm",
      health_comfort_notes: null,
      grooming_preferences: null,
      rabies_status: "current",
      archived_at: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    };

    const record = mapPetRowToRecord(row);
    assert.equal(record.weightLbs, 12);
    assert.equal(record.temperamentNotes, "Calm");
    assert.equal(record.healthComfortNotes, null);
    assert.equal(record.rabiesStatus, "current");
  });
});

describe("mapValidatedInputToInsertRow", () => {
  it("maps validated input to insert columns only", () => {
    const row = mapValidatedInputToInsertRow({
      name: "Bella",
      breed: "Shih Tzu",
      weightLbs: 12,
      dateOfBirth: null,
      approximateAgeYears: 3,
      sex: null,
      temperamentNotes: null,
      healthComfortNotes: null,
      groomingPreferences: null,
      rabiesStatus: "medical_exemption",
    });

    assert.deepEqual(row, {
      name: "Bella",
      breed: "Shih Tzu",
      weight_lbs: 12,
      date_of_birth: null,
      approximate_age_years: 3,
      sex: null,
      temperament_notes: null,
      health_comfort_notes: null,
      grooming_preferences: null,
      rabies_status: "medical_exemption",
      rabies_expiration_date: null,
    });
    assert.equal("customer_id" in row, false);
  });
});

describe("mapPetRecordToUiProfile", () => {
  it("maps API records to the UI profile shape", () => {
    const profile = mapPetRecordToUiProfile({
      id: "11111111-1111-4111-8111-111111111111",
      name: "Bella",
      breed: "Shih Tzu",
      weightLbs: 12,
      dateOfBirth: null,
      approximateAgeYears: 4,
      sex: "Female",
      temperamentNotes: "Calm",
      healthComfortNotes: "None",
      groomingPreferences: null,
      vaccinationBookingStatus: "needs_review",
      vaccinationExpirationDate: "2026-11-01",
      vaccinationHasUpload: true,
      vaccinationLatestRecordId: "44444444-4444-4444-8444-444444444444",
      rabiesStatus: "current",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    assert.equal(profile.approximateAgeYears, 4);
    assert.equal(profile.temperament, "Calm");
    assert.equal(profile.medicalNotes, "None");
    assert.equal(profile.vaccineRecordUploaded, true);
    assert.equal(profile.vaccinationBookingStatus, "needs_review");
    assert.equal(profile.vaccineExpiration, "2026-11-01");
    assert.equal(profile.rabiesStatus, "current");
    assert.equal(
      profile.vaccinationLatestRecordId,
      "44444444-4444-4444-8444-444444444444",
    );
  });

  it("defaults vaccination fields when absent", () => {
    const profile = mapPetRecordToUiProfile({
      id: "11111111-1111-4111-8111-111111111111",
      name: "Bella",
      breed: "Shih Tzu",
      weightLbs: 12,
      dateOfBirth: null,
      approximateAgeYears: 4,
      sex: null,
      temperamentNotes: null,
      healthComfortNotes: null,
      groomingPreferences: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    assert.equal(profile.vaccineRecordUploaded, false);
    assert.equal(profile.vaccinationBookingStatus, "missing");
    assert.equal(profile.rabiesStatus, null);
  });
});

describe("mapPetProfileToWriteInput", () => {
  it("maps exact DOB profiles to API input", () => {
    const input = mapPetProfileToWriteInput({
      id: "draft-1",
      name: " Bella ",
      breed: " Shih Tzu ",
      weightLbs: 12,
      dateOfBirth: "2017-05-18",
      vaccineRecordUploaded: false,
      rabiesStatus: "current",
    });

    assert.equal(input.name, "Bella");
    assert.equal(input.dateOfBirth, "2017-05-18");
    assert.equal(input.approximateAgeYears, null);
    assert.equal(input.rabiesStatus, "current");
  });

  it("maps approximate age years to API input", () => {
    const input = mapPetProfileToWriteInput({
      id: "draft-2",
      name: "Max",
      breed: "Poodle",
      weightLbs: 18,
      approximateAgeYears: 3,
      vaccineRecordUploaded: false,
    });

    assert.equal(input.approximateAgeYears, 3);
    assert.equal(input.dateOfBirth, null);
    assert.equal(input.rabiesExpirationDate, null);
  });

  it("sends the record expiration date with the pet profile", () => {
    const input = mapPetProfileToWriteInput({
      id: "draft-3",
      name: "Gigi",
      breed: "Yorkshire Terrier",
      weightLbs: 5,
      vaccineRecordUploaded: false,
      vaccineExpiration: "2027-06-15",
    });
    assert.equal(input.rabiesExpirationDate, "2027-06-15");
    assert.equal(
      mapValidatedInputToUpdateRow(input).rabies_expiration_date,
      "2027-06-15",
    );
  });
});

describe("saved record expiration", () => {
  it("prefers the date saved on the pet over an older upload", () => {
    const profile = mapPetRecordToUiProfile({
      id: "11111111-1111-4111-8111-111111111111",
      name: "Gigi",
      breed: "Yorkshire Terrier",
      weightLbs: 5,
      dateOfBirth: null,
      approximateAgeYears: 12,
      sex: null,
      temperamentNotes: null,
      healthComfortNotes: null,
      groomingPreferences: null,
      rabiesExpirationDate: "2027-06-15",
      vaccinationExpirationDate: "2026-01-01",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    assert.equal(profile.vaccineExpiration, "2027-06-15");
  });

  it("reads the date back from the pet row", () => {
    const record = mapPetRowToRecord({
      id: "11111111-1111-4111-8111-111111111111",
      customer_id: "22222222-2222-4222-8222-222222222222",
      name: "Gigi",
      breed: "Yorkshire Terrier",
      weight_lbs: 5,
      date_of_birth: null,
      approximate_age_years: 12,
      sex: null,
      temperament_notes: null,
      health_comfort_notes: null,
      grooming_preferences: null,
      rabies_status: "current",
      rabies_expiration_date: "2027-06-15T00:00:00.000Z",
      archived_at: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    });
    assert.equal(record.rabiesExpirationDate, "2027-06-15");
    assert.equal(
      mapPetRecordToUiProfile(record).vaccineExpiration,
      "2027-06-15",
    );
  });
});

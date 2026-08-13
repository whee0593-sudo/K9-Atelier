import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mapPetRowToRecord, mapPetProfileToWriteInput, mapPetRecordToUiProfile, mapValidatedInputToInsertRow } from "@/lib/pets/map";
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
      archived_at: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    };

    const record = mapPetRowToRecord(row);
    assert.equal(record.weightLbs, 12);
    assert.equal(record.temperamentNotes, "Calm");
    assert.equal(record.healthComfortNotes, null);
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
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    assert.equal(profile.approximateAgeYears, 4);
    assert.equal(profile.temperament, "Calm");
    assert.equal(profile.medicalNotes, "None");
    assert.equal(profile.vaccineRecordUploaded, true);
    assert.equal(profile.vaccinationBookingStatus, "needs_review");
    assert.equal(profile.vaccineExpiration, "2026-11-01");
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
    });

    assert.equal(input.name, "Bella");
    assert.equal(input.dateOfBirth, "2017-05-18");
    assert.equal(input.approximateAgeYears, null);
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
  });
});

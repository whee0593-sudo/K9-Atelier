import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MAX_DOG_AGE_YEARS,
  dateOfBirthInputYearLooksComplete,
  earliestAllowedDateOfBirth,
  formatIsoDateLocal,
  latestAllowedDateOfBirth,
  nextDateOfBirthFromInput,
} from "@/lib/pet-age";

describe("date of birth input helpers", () => {
  it("formats local calendar dates without UTC shift", () => {
    assert.equal(formatIsoDateLocal(new Date(2026, 8, 19)), "2026-09-19");
    assert.equal(latestAllowedDateOfBirth(new Date(2026, 8, 19)), "2026-09-19");
    assert.equal(
      earliestAllowedDateOfBirth(new Date(2026, 8, 19)),
      `${2026 - MAX_DOG_AGE_YEARS}-09-19`,
    );
  });

  it("treats Chrome padded years as still being typed", () => {
    assert.equal(dateOfBirthInputYearLooksComplete("0019-01-01"), false);
    assert.equal(dateOfBirthInputYearLooksComplete("0002-05-18"), false);
    assert.equal(dateOfBirthInputYearLooksComplete("0201-05-18"), false);
    assert.equal(dateOfBirthInputYearLooksComplete("2019-05-18"), true);
  });

  it("does not commit a padded year so the date field can keep receiving digits", () => {
    assert.deepEqual(nextDateOfBirthFromInput("0019-01-01"), {
      commit: undefined,
      error: null,
    });
    assert.deepEqual(nextDateOfBirthFromInput("0002-05-18"), {
      commit: undefined,
      error: null,
    });
  });

  it("commits a finished in-range birthday", () => {
    assert.deepEqual(nextDateOfBirthFromInput("2019-05-18"), {
      commit: "2019-05-18",
      error: null,
    });
  });

  it("clears the birthday when the field is emptied", () => {
    assert.deepEqual(nextDateOfBirthFromInput(""), {
      commit: null,
      error: null,
    });
  });

  it("shows an error for a finished date that is too old or in the future", () => {
    const tooOld = nextDateOfBirthFromInput("1980-01-01");
    assert.equal(tooOld.commit, undefined);
    assert.match(tooOld.error ?? "", /last 30 years/);

    const future = nextDateOfBirthFromInput("2099-01-01");
    assert.equal(future.commit, undefined);
    assert.match(future.error ?? "", /future/);
  });
});

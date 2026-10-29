import assert from "node:assert/strict";
import { test } from "node:test";
import { validateCustomerBirthday } from "./validation";

test("optional birthdays preserve omitted values and allow clearing", () => {
  assert.equal(validateCustomerBirthday(undefined), undefined);
  assert.equal(validateCustomerBirthday(""), null);
  assert.equal(validateCustomerBirthday(null), null);
});
test("birthdays accept real dates, including leap days", () => {
  assert.equal(validateCustomerBirthday("2000-02-29"), "2000-02-29");
});
test("birthdays reject invalid and future dates", () => {
  for (const value of ["2001-02-29", "2020-04-31", "2999-01-01", "01/01/2000", 123]) {
    assert.throws(() => validateCustomerBirthday(value));
  }
});

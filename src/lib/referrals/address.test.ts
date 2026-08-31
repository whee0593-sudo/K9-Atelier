import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  compareServiceAddresses,
  householdVisitKey,
  normalizeServiceAddress,
  normalizeStreetAddress,
  normalizeZip,
} from "./address";

describe("referral address normalization", () => {
  it("keeps Street and St as the same street and retains Apt 4B", () => {
    const apt = normalizeServiceAddress({
      street: "123 Example Street Apt 4B",
      zip: "33401",
    });
    const st = normalizeServiceAddress({
      street: "123 Example St",
      unit: "4B",
      zip: "33401",
    });
    assert.equal(normalizeStreetAddress("123 Example Street Apt 4B"), "123 example st");
    assert.equal(normalizeStreetAddress("123 Example St"), "123 example st");
    assert.equal(apt.normalizedStreetAddress, "123 example st");
    assert.equal(apt.normalizedUnit, "4b");
    assert.equal(st.normalizedUnit, "4b");
    assert.equal(apt.normalizedZip5, "33401");
  });

  it("does not treat Apt 4B and Unit 2 as the same household address", () => {
    assert.equal(
      compareServiceAddresses(
        { street: "123 Example St Apt 4B", zip: "33401" },
        { street: "123 Example Street Unit 2", zip: "33401" },
      ),
      "different",
    );
  });

  it("sends incomplete unit information to review", () => {
    assert.equal(
      compareServiceAddresses(
        { street: "123 Example St Apt 4B", zip: "33401" },
        { street: "123 Example St", zip: "33401" },
      ),
      "review",
    );
  });

  it("uses the first five ZIP digits", () => {
    assert.equal(normalizeZip("33418-1234"), "33418");
    assert.equal(normalizeZip("33418"), "33418");
  });

  it("groups one customer’s same-day same-unit dogs together", () => {
    const left = householdVisitKey({
      customerId: "c1",
      appointmentDate: "2026-09-01",
      addressStreet: "123 Example Street Apt 2",
      addressZip: "33418-9999",
    });
    const right = householdVisitKey({
      customerId: "c1",
      appointmentDate: "2026-09-01",
      addressStreet: "123 Example St Unit 2",
      addressZip: "33418",
    });
    assert.equal(left, right);
  });

  it("does not merge different customers in the same apartment building", () => {
    const left = householdVisitKey({
      customerId: "c1",
      appointmentDate: "2026-09-01",
      addressStreet: "123 Example St Apt 4B",
      addressZip: "33401",
    });
    const right = householdVisitKey({
      customerId: "c2",
      appointmentDate: "2026-09-01",
      addressStreet: "123 Example Street Unit 2",
      addressZip: "33401",
    });
    assert.notEqual(left, right);
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildStaffCustomerSms } from "./staff-compose-copy";

describe("staff customer SMS", () => {
  it("prefixes the studio name and adds STOP", () => {
    const body = buildStaffCustomerSms("Bella is ready for pickup.");
    assert.equal(
      body,
      "K9 ATELIER: Bella is ready for pickup.\n\nReply STOP to opt out.",
    );
  });

  it("does not double the prefix or STOP line", () => {
    const body = buildStaffCustomerSms(
      "K9 ATELIER: Running 10 minutes late. Reply STOP to opt out.",
    );
    assert.equal(
      body,
      "K9 ATELIER: Running 10 minutes late. Reply STOP to opt out.",
    );
  });
});

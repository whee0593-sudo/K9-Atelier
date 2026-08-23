import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildStaffCustomerSms, buildStudioIntroSms } from "./staff-compose-copy";

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

  it("includes booking, contact, and a reply prompt", () => {
    const body = buildStudioIntroSms();
    assert.equal(
      body,
      [
        "K9 ATELIER: Thank you for calling. We're taking care of a guest and unable to answer at the moment.",
        "",
        "Reserve an appointment:",
        "https://k9atelier.com/book",
        "",
        "Send us a message:",
        "https://k9atelier.com/contact",
        "",
        "You may also reply with your pet's name, breed, age, weight, coat condition, and preferred appointment date. We'll get back to you as soon as we're available.",
        "",
        "Reply STOP to opt out.",
      ].join("\n"),
    );
  });
});

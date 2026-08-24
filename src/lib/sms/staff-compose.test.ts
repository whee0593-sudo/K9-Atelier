import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildStaffCustomerSms,
  buildStudioIntroSms,
  formatStaffRecipientLabel,
  matchesStaffRecipientSearch,
  staffRecipientSortKey,
  type StaffSmsRecipient,
} from "./staff-compose-copy";

function recipient(
  overrides: Partial<StaffSmsRecipient> = {},
): StaffSmsRecipient {
  return {
    id: "1",
    firstName: "Alex",
    lastName: "Rivera",
    name: "Alex Rivera",
    email: "alex@example.com",
    phone: "+15615550123",
    petNames: ["Maple"],
    canText: true,
    ...overrides,
  };
}

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
        "Send an online inquiry:",
        "https://k9atelier.com/contact",
        "",
        "Or reply with your pet's name, breed, age, weight, coat condition, and preferred appointment date. We'll get back to you as soon as we're available.",
        "",
        "Reply STOP to opt out.",
      ].join("\n"),
    );
  });

  it("labels a recipient as pet, first, last, and phone", () => {
    assert.equal(
      formatStaffRecipientLabel(recipient()),
      "Maple · Alex · Rivera · (561) 555-0123",
    );
    assert.equal(
      formatStaffRecipientLabel(
        recipient({ petNames: [], firstName: "", lastName: "", canText: false, phone: "" }),
      ),
      "— · — · — · no mobile number",
    );
  });

  it("searches by pet, first name, last name, or phone digits", () => {
    const item = recipient({ petNames: ["Otto", "Maple"] });
    assert.equal(matchesStaffRecipientSearch(item, "ott"), true);
    assert.equal(matchesStaffRecipientSearch(item, "ALE"), true);
    assert.equal(matchesStaffRecipientSearch(item, "river"), true);
    assert.equal(matchesStaffRecipientSearch(item, "555-0123"), true);
    assert.equal(matchesStaffRecipientSearch(item, "5615550123"), true);
    assert.equal(matchesStaffRecipientSearch(item, "bella"), false);
  });

  it("sorts recipients A–Z by the visible label", () => {
    const bella = recipient({ id: "b", petNames: ["Bella"], firstName: "Zoe" });
    const maple = recipient({ id: "m", petNames: ["Maple"], firstName: "Alex" });
    const keys = [bella, maple].map(staffRecipientSortKey).sort((a, b) =>
      a.localeCompare(b, "en"),
    );
    assert.equal(keys[0], staffRecipientSortKey(bella));
    assert.equal(keys[1], staffRecipientSortKey(maple));
  });
});

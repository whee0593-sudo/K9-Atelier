import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("customer account helper copy", () => {
  it("does not keep field notes on Personal Information", () => {
    const source = readFileSync(
      new URL("./CustomerProfileForm.tsx", import.meta.url),
      "utf8",
    );
    assert.equal(source.includes("Used for receipts"), false);
    assert.equal(source.includes("thank-you after checkout"), false);
    assert.equal(
      source.includes("Optional — someone we can contact if we cannot reach you."),
      false,
    );
  });

  it("does not render JSON field notes on customer account forms", () => {
    const fieldsForm = readFileSync(
      new URL("./AccountFieldsForm.tsx", import.meta.url),
      "utf8",
    );
    const petFields = readFileSync(
      new URL("./PetScalarFields.tsx", import.meta.url),
      "utf8",
    );
    const sectionPage = readFileSync(
      new URL("../../app/account/[slug]/page.tsx", import.meta.url),
      "utf8",
    );
    assert.equal(fieldsForm.includes("{field.note}"), false);
    assert.match(petFields, /showFieldNotes && field.note/);
    assert.equal(sectionPage.includes("section.description"), false);
    assert.equal(sectionPage.includes("You can save multiple addresses."), false);
  });
});

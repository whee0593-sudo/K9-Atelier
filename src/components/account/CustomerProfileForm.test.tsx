import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CustomerProfileForm } from "@/components/account/CustomerProfileForm";
import type { CustomerProfile } from "@/lib/profiles/types";

const incompleteProfile: CustomerProfile = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "tiafrancavilla@gmail.com",
  firstName: "",
  lastName: "",
  phone: "+15613466778",
  preferredContact: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
  emergencyContactRelationship: "",
};

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

describe("customer profile required fields", () => {
  it("uses a save form so required fields can be blocked", () => {
    const html = renderToStaticMarkup(
      <CustomerProfileForm
        profile={incompleteProfile}
        saveUrl="/api/admin/customers/11111111-1111-4111-8111-111111111111"
      />,
    );
    assert.match(html, /<form /);
    assert.match(html, /type="submit"/);
    assert.match(html, /First Name/);
    assert.match(html, /Last Name/);
    assert.match(html, /Mobile Phone/);
  });

  it("lists the blank required columns on an incomplete Tia profile", () => {
    const html = renderToStaticMarkup(
      <CustomerProfileForm
        profile={incompleteProfile}
        saveUrl="/api/account/profile"
      />,
    );
    assert.match(
      html,
      /This profile cannot be saved until you complete: First Name, Last Name\./,
    );
    assert.match(html, /First Name is required\./);
    assert.match(html, /Last Name is required\./);
    assert.doesNotMatch(html, /Mobile Phone is required\./);
  });

  it("lets staff edit an incomplete customer file without locking the form", () => {
    const html = renderToStaticMarkup(
      <CustomerProfileForm
        profile={incompleteProfile}
        saveUrl="/api/admin/customers/11111111-1111-4111-8111-111111111111"
        audience="staff"
        preview
      />,
    );
    assert.match(html, /type="submit"/);
    assert.match(html, />Save Profile</);
    assert.doesNotMatch(
      html,
      /This profile cannot be saved until you complete/,
    );
    assert.doesNotMatch(html, /First Name is required\./);
    assert.match(html, /tiafrancavilla@gmail.com/);
    assert.match(html, /readOnly/);
  });
});

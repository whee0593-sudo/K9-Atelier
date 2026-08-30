import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CONTACT_INQUIRY_CONSULTATION,
  CONTACT_INQUIRY_GENERAL,
  MAX_SUPPORT_PHOTOS,
  inquiryTypeFromQuery,
  inquiryTypeLabel,
  isAllowedSupportPhoto,
} from "./support-contact";

describe("inquiryTypeFromQuery", () => {
  it("selects grooming consultation from the contact URL", () => {
    assert.equal(
      inquiryTypeFromQuery("grooming-consultation"),
      CONTACT_INQUIRY_CONSULTATION,
    );
  });

  it("defaults other or missing values to a general inquiry", () => {
    assert.equal(inquiryTypeFromQuery(undefined), CONTACT_INQUIRY_GENERAL);
    assert.equal(inquiryTypeFromQuery("concern"), CONTACT_INQUIRY_GENERAL);
    assert.equal(inquiryTypeFromQuery(""), CONTACT_INQUIRY_GENERAL);
  });
});

describe("inquiryTypeLabel", () => {
  it("returns the customer-facing labels", () => {
    assert.equal(inquiryTypeLabel(CONTACT_INQUIRY_GENERAL), "General Inquiry");
    assert.equal(
      inquiryTypeLabel(CONTACT_INQUIRY_CONSULTATION),
      "Grooming Consultation",
    );
  });
});

describe("support photo limits", () => {
  it("allows up to five photos", () => {
    assert.equal(MAX_SUPPORT_PHOTOS, 5);
  });

  it("accepts JPG, JPEG, PNG, and WEBP", () => {
    assert.equal(
      isAllowedSupportPhoto(new File([], "coat.jpg", { type: "image/jpeg" })),
      true,
    );
    assert.equal(
      isAllowedSupportPhoto(new File([], "coat.jpeg", { type: "" })),
      true,
    );
    assert.equal(
      isAllowedSupportPhoto(new File([], "coat.png", { type: "image/png" })),
      true,
    );
    assert.equal(
      isAllowedSupportPhoto(new File([], "coat.webp", { type: "image/webp" })),
      true,
    );
    assert.equal(
      isAllowedSupportPhoto(new File([], "notes.pdf", { type: "application/pdf" })),
      false,
    );
  });
});

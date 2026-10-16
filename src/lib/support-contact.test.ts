import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CONTACT_INQUIRY_CONSULTATION,
  CONTACT_INQUIRY_GENERAL,
  MAX_SUPPORT_PHOTOS,
  SUPPORT_CONTACT_INVALID,
  SUPPORT_CONTACT_REQUIRED,
  SUPPORT_EMAIL_INVALID,
  SUPPORT_PHONE_INVALID,
  inquiryTypeFromQuery,
  inquiryTypeLabel,
  isAllowedSupportPhoto,
  resolveSupportChannels,
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

describe("resolveSupportChannels", () => {
  it("accepts email only, phone only, and both", () => {
    assert.deepEqual(resolveSupportChannels({ email: " Guest@Example.com " }), {
      ok: true,
      email: "Guest@Example.com",
      phone: "",
    });
    assert.deepEqual(
      resolveSupportChannels({ phone: "(847) 624-5115" }),
      { ok: true, email: "", phone: "(847) 624-5115" },
    );
    assert.deepEqual(
      resolveSupportChannels({
        email: "guest@example.com",
        phone: "8476245115",
      }),
      { ok: true, email: "guest@example.com", phone: "8476245115" },
    );
  });

  it("rejects a missing contact method and illegal formats", () => {
    assert.deepEqual(resolveSupportChannels({ email: " ", phone: "" }), {
      ok: false,
      error: SUPPORT_CONTACT_REQUIRED,
    });
    assert.deepEqual(resolveSupportChannels({ email: "not-an-email" }), {
      ok: false,
      error: SUPPORT_EMAIL_INVALID,
    });
    assert.deepEqual(resolveSupportChannels({ phone: "123" }), {
      ok: false,
      error: SUPPORT_PHONE_INVALID,
    });
    assert.deepEqual(
      resolveSupportChannels({
        email: "guest@example.com",
        phone: "12345",
      }),
      { ok: false, error: SUPPORT_PHONE_INVALID },
    );
  });

  it("keeps the legacy single contact field working", () => {
    assert.deepEqual(resolveSupportChannels({ contact: "guest@example.com" }), {
      ok: true,
      email: "guest@example.com",
      phone: "",
    });
    assert.deepEqual(resolveSupportChannels({ contact: "8476245115" }), {
      ok: true,
      email: "",
      phone: "8476245115",
    });
    assert.deepEqual(resolveSupportChannels({ contact: "hello" }), {
      ok: false,
      error: SUPPORT_CONTACT_INVALID,
    });
    assert.deepEqual(
      resolveSupportChannels({
        email: "",
        phone: "",
        contact: "legacy@example.com",
      }),
      { ok: true, email: "legacy@example.com", phone: "" },
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

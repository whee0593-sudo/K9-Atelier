import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  EMAIL_INQUIRY_NOTICE,
  PHONE_AVAILABLE_NOTICE,
  buildSupportNotification,
} from "./support-mail";

const submittedAt = "2026-10-16T01:05:58.589Z";

describe("buildSupportNotification", () => {
  it("marks an email-only inquiry as directly replyable", () => {
    const mail = buildSupportNotification({
      email: "guest@example.com",
      phone: "",
      inquiryLabel: "General Inquiry",
      guestSubject: "Milkshake",
      groomingPreferences: "",
      isConcern: false,
      message: "Please book Milkshake.",
      submittedAt,
    });

    assert.equal(mail.replyTo, "guest@example.com");
    assert.equal(
      mail.subject,
      "K9 Atelier: Milkshake (Email: guest@example.com)",
    );
    assert.ok(mail.text.startsWith(EMAIL_INQUIRY_NOTICE));
    assert.equal(mail.text.includes(PHONE_AVAILABLE_NOTICE), false);
    assert.match(mail.text, /Email: guest@example.com/);
    assert.equal(mail.text.includes("Phone:"), false);
  });

  it("asks the studio to text a phone-only inquiry and leaves Reply-To unset", () => {
    const mail = buildSupportNotification({
      email: "",
      phone: "8476245115",
      inquiryLabel: "General Inquiry",
      guestSubject: "Milkshake",
      groomingPreferences: "",
      isConcern: false,
      message: "Todd and Brook would like to book Milkshake.",
      submittedAt,
    });

    assert.equal(mail.replyTo, undefined);
    assert.equal(mail.subject, "K9 Atelier: Milkshake (Phone: 8476245115)");
    assert.ok(mail.text.startsWith(PHONE_AVAILABLE_NOTICE));
    assert.equal(mail.text.includes(EMAIL_INQUIRY_NOTICE), false);
    assert.match(mail.text, /Phone: 8476245115/);
    assert.equal(mail.text.includes("\nEmail:"), false);
    assert.equal(mail.text.includes("SMS"), true);
  });

  it("prefers the SMS notice when both channels are present and still sets Reply-To", () => {
    const mail = buildSupportNotification({
      email: "guest@example.com",
      phone: "(847) 624-5115",
      inquiryLabel: "General Inquiry",
      guestSubject: "Milkshake",
      groomingPreferences: "",
      isConcern: false,
      message: "Both channels.",
      submittedAt,
    });

    assert.equal(mail.replyTo, "guest@example.com");
    assert.equal(mail.replyTo === "(847) 624-5115", false);
    assert.equal(
      mail.subject,
      "K9 Atelier: Milkshake (Phone: (847) 624-5115, Email: guest@example.com)",
    );
    assert.ok(mail.text.startsWith(PHONE_AVAILABLE_NOTICE));
    assert.equal(mail.text.includes(EMAIL_INQUIRY_NOTICE), false);
    assert.ok(mail.text.indexOf("Phone:") < mail.text.indexOf("Email:"));
    assert.match(mail.text, /Email Reply will NOT send an SMS/);
  });
});

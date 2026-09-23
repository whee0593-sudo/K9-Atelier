import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildNextDayFollowUpEmail,
  buildNextDayFollowUpSms,
  followUpGreetingName,
  followUpPetName,
  followUpReviewUrl,
} from "./copy";

describe("next-day follow-up copy", () => {
  it("uses the client's first name and the dog's name", () => {
    assert.equal(followUpGreetingName("Maya"), "Maya");
    assert.equal(followUpGreetingName("  "), "there");
    assert.equal(followUpPetName("Daisy"), "Daisy");
    assert.equal(followUpPetName(null), "your dog");
  });

  it("matches Penny's check-in SMS", () => {
    assert.equal(
      buildNextDayFollowUpSms({ firstName: "Maya", petName: "Daisy" }),
      [
        "Hi Maya! This is Penny from K9 Atelier. Just checking in to see how Daisy is doing after yesterday's groom. 💜",
        "",
        "If you have any questions or feedback, please feel free to text me anytime. And if you loved Daisy's experience, I'd really appreciate a quick Google review:",
        "",
        followUpReviewUrl(),
        "",
        "Thank you again for trusting me with Daisy!",
        "",
        "Reply STOP to opt out.",
      ].join("\n"),
    );
  });

  it("matches Penny's check-in email", () => {
    const email = buildNextDayFollowUpEmail({
      firstName: "Maya",
      petName: "Daisy",
    });
    assert.equal(email.subject, "Checking in after Daisy's groom");
    assert.equal(
      email.text,
      [
        "Hi Maya,",
        "",
        "I just wanted to check in and see how Daisy is doing after yesterday's grooming appointment. I hope you're both enjoying the fresh new look!",
        "",
        "Your experience—and Daisy's comfort—are very important to me. If you have any questions or feedback about the groom, coat, or at-home care, please feel free to reach out anytime.",
        "",
        "If you were happy with your experience, I'd truly appreciate it if you would take a moment to share a Google review. Your feedback means a lot to us and helps other local pet parents feel confident choosing K9 Atelier.",
        "",
        "Leave a Google Review:",
        followUpReviewUrl(),
        "",
        "Thank you again for trusting me with Daisy. I look forward to seeing you both again.",
        "",
        "Warmly,",
        "Penny",
        "K9 Atelier",
        "Private Mobile Pet Spa",
        "Palm Beach",
      ].join("\n"),
    );
    assert.match(email.html, /Hi Maya,/);
    assert.match(email.html, /Leave a Google Review/);
    assert.match(email.html, /Warmly,<br\/>Penny<br\/>K9 Atelier/);
    assert.match(email.html, /https:\/\/k9atelier\.com\/email-logo\.png/);
  });
});

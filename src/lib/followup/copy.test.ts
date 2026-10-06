import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildNextDayFollowUpEmail,
  buildNextDayFollowUpSms,
  followUpGreetingName,
  followUpPetLabel,
  followUpPetName,
  followUpReviewUrl,
} from "./copy";

const GSM_BASIC = new Set(
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà",
);

function gsmSeptets(text: string) {
  let septets = 0;
  for (const char of text) {
    if (!GSM_BASIC.has(char)) return null;
    septets += 1;
  }
  return septets;
}

describe("next-day follow-up copy", () => {
  it("uses the client's first name and the dog's name", () => {
    assert.equal(followUpGreetingName("Maya"), "Maya");
    assert.equal(followUpGreetingName("  "), "there");
    assert.equal(followUpPetName("Daisy"), "Daisy");
    assert.equal(followUpPetName(null), "your dog");
    assert.equal(followUpPetLabel(["Daisy", "Milo"]), "Daisy and Milo");
    assert.equal(followUpPetLabel(["Daisy", "Milo", "Otto"]), "your pups");
  });

  it("matches the short household review SMS", () => {
    const sms = buildNextDayFollowUpSms({
      firstName: "Maya",
      petName: "Daisy",
    });
    const reviewUrl = followUpReviewUrl();
    assert.equal(
      sms,
      [
        `K9 ATELIER: Thanks for trusting us with Daisy yesterday. We'd appreciate your Google review: ${reviewUrl}`,
        "Reply STOP to opt out.",
      ].join("\n"),
    );
    assert.equal(sms.split("https://").length - 1, 1);
    assert.equal(sms.includes("If you enjoyed"), false);
    assert.equal(sms.includes("💜"), false);
    const septets = gsmSeptets(sms);
    assert.equal(septets, 155);
    assert.equal(septets <= 160 ? 1 : Math.ceil(septets / 153), 1);
  });

  it("names two dogs once in the review SMS", () => {
    const sms = buildNextDayFollowUpSms({
      petNames: ["Milo", "Daisy"],
    });
    assert.equal(
      sms,
      [
        `K9 ATELIER: Thanks for trusting us with Daisy and Milo yesterday. We'd appreciate your Google review: ${followUpReviewUrl()}`,
        "Reply STOP to opt out.",
      ].join("\n"),
    );
    const septets = gsmSeptets(sms);
    assert.equal(septets, 164);
    assert.equal(septets <= 160 ? 1 : Math.ceil(septets / 153), 2);
  });

  it("uses your pups for three or more dogs", () => {
    const sms = buildNextDayFollowUpSms({
      petNames: ["Otto", "Daisy", "Milo"],
    });
    assert.equal(
      sms,
      [
        `K9 ATELIER: Thanks for trusting us with your pups yesterday. We'd appreciate your Google review: ${followUpReviewUrl()}`,
        "Reply STOP to opt out.",
      ].join("\n"),
    );
    const septets = gsmSeptets(sms);
    assert.equal(septets, 159);
    assert.equal(septets <= 160 ? 1 : Math.ceil(septets / 153), 1);
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
        "I'd truly appreciate it if you would take a moment to share a Google review. Your feedback means a lot to us and helps other local pet parents feel confident choosing K9 Atelier.",
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
    assert.equal(email.html.match(/<a /g)?.length, 1);
    assert.equal(email.html.includes("If you were happy"), false);
    assert.match(email.html, /Warmly,<br\/>Penny<br\/>K9 Atelier/);
    assert.match(email.html, /https:\/\/k9atelier\.com\/email-logo\.png/);
  });

  it("uses one review CTA for two dogs", () => {
    const email = buildNextDayFollowUpEmail({
      firstName: "Jane",
      petNames: ["Daisy", "Milo"],
    });
    assert.equal(email.subject, "Checking in after Daisy and Milo's groom");
    assert.match(email.text, /how Daisy and Milo are doing/);
    assert.equal(email.html.match(/<a /g)?.length, 1);
    assert.match(email.html, /Leave a Google Review/);
  });
});

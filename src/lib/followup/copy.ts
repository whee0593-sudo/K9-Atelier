import {
  getGoogleProfileUrl,
  getGoogleWriteReviewUrl,
} from "@/lib/business";
import { buildCustomerFollowUpEmail } from "@/lib/email/layout";

const SMS_OPT_OUT = "Reply STOP to opt out.";

export type FollowUpNames = {
  firstName?: string | null;
  petName?: string | null;
};

export function followUpGreetingName(firstName?: string | null) {
  const first = firstName?.trim();
  if (first) return first;
  return "there";
}

export function followUpPetName(petName?: string | null) {
  return petName?.trim() || "your dog";
}

export function followUpReviewUrl() {
  return (
    getGoogleWriteReviewUrl() ||
    getGoogleProfileUrl() ||
    "https://k9atelier.com"
  );
}

export function buildNextDayFollowUpSms(input: FollowUpNames) {
  const firstName = followUpGreetingName(input.firstName);
  const petName = followUpPetName(input.petName);
  return [
    `Hi ${firstName}! This is Penny from K9 Atelier. Just checking in to see how ${petName} is doing after yesterday's groom. 💜`,
    "",
    `If you have any questions or feedback, please feel free to text me anytime. And if you loved ${petName}'s experience, I'd really appreciate a quick Google review:`,
    "",
    followUpReviewUrl(),
    "",
    `Thank you again for trusting me with ${petName}!`,
    "",
    SMS_OPT_OUT,
  ].join("\n");
}

export function buildNextDayFollowUpEmail(input: FollowUpNames) {
  const firstName = followUpGreetingName(input.firstName);
  const petName = followUpPetName(input.petName);
  const reviewUrl = followUpReviewUrl();
  const introParagraphs = [
    `I just wanted to check in and see how ${petName} is doing after yesterday's grooming appointment. I hope you're both enjoying the fresh new look!`,
    `Your experience—and ${petName}'s comfort—are very important to me. If you have any questions or feedback about the groom, coat, or at-home care, please feel free to reach out anytime.`,
    `If you were happy with your experience, I'd truly appreciate it if you would take a moment to share a Google review. Your feedback means a lot to us and helps other local pet parents feel confident choosing K9 Atelier.`,
  ];
  const closingParagraph = `Thank you again for trusting me with ${petName}. I look forward to seeing you both again.`;
  const signoffLines = [
    "K9 Atelier",
    "Private Mobile Pet Spa",
    "Palm Beach",
  ];
  const subject = `Checking in after ${petName}'s groom`;
  const text = [
    `Hi ${firstName},`,
    "",
    introParagraphs.join("\n\n"),
    "",
    "Leave a Google Review:",
    reviewUrl,
    "",
    closingParagraph,
    "",
    "Warmly,",
    "Penny",
    ...signoffLines,
  ].join("\n");

  return buildCustomerFollowUpEmail(
    {
      subject,
      greetingName: firstName,
      introParagraphs,
      cta: { href: reviewUrl, label: "Leave a Google Review" },
      closingParagraph,
      signoffName: "Penny",
      signoffLines,
    },
    text,
  );
}

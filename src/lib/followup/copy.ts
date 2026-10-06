import {
  getGoogleProfileUrl,
  getGoogleWriteReviewUrl,
} from "@/lib/business";
import { buildCustomerFollowUpEmail } from "@/lib/email/layout";

const SMS_OPT_OUT = "Reply STOP to opt out.";

export type FollowUpNames = {
  firstName?: string | null;
  petName?: string | null;
  petNames?: Array<string | null | undefined> | null;
};

export function followUpGreetingName(firstName?: string | null) {
  const first = firstName?.trim();
  if (first) return first;
  return "there";
}

export function followUpPetName(petName?: string | null) {
  return petName?.trim() || "your dog";
}

export function followUpPetNames(input: FollowUpNames) {
  const listed = (input.petNames ?? [])
    .map((name) => name?.trim() ?? "")
    .filter(Boolean);
  if (listed.length > 0) return listed;
  const single = input.petName?.trim();
  return single ? [single] : [];
}

/** One name, "Daisy and Milo", or "your pups" when there are three or more. */
export function followUpPetLabel(names: string[]) {
  const clean = names.map((name) => name.trim()).filter(Boolean);
  if (clean.length === 0) return "your dog";
  if (clean.length === 1) return clean[0] ?? "your dog";
  const unique = [...new Set(clean)].sort((left, right) =>
    left.localeCompare(right),
  );
  if (unique.length === 2) return `${unique[0]} and ${unique[1]}`;
  return "your pups";
}

export function followUpPetPossessive(label: string) {
  if (label === "your pups") return "your pups'";
  return `${label}'s`;
}

export function followUpReviewUrl() {
  return (
    getGoogleWriteReviewUrl() ||
    getGoogleProfileUrl() ||
    "https://k9atelier.com"
  );
}

export function buildNextDayFollowUpSms(input: FollowUpNames) {
  const label = followUpPetLabel(followUpPetNames(input));
  return [
    `K9 ATELIER: Thanks for trusting us with ${label} yesterday. We'd appreciate your Google review: ${followUpReviewUrl()}`,
    SMS_OPT_OUT,
  ].join("\n");
}

export function buildNextDayFollowUpEmail(input: FollowUpNames) {
  const names = followUpPetNames(input);
  const firstName = followUpGreetingName(input.firstName);
  const label = followUpPetLabel(names);
  const several = names.length >= 2;
  const petName = several ? label : followUpPetName(label);
  const possessive = followUpPetPossessive(petName);
  const reviewUrl = followUpReviewUrl();
  const introParagraphs = several
    ? [
        `I just wanted to check in and see how ${label} are doing after yesterday's grooming appointment. I hope you're enjoying their fresh new looks!`,
        `Your experience—and ${possessive} comfort—are very important to me. If you have any questions or feedback about the groom, coat, or at-home care, please feel free to reach out anytime.`,
        "I'd truly appreciate it if you would take a moment to share a Google review. Your feedback means a lot to us and helps other local pet parents feel confident choosing K9 Atelier.",
      ]
    : [
        `I just wanted to check in and see how ${petName} is doing after yesterday's grooming appointment. I hope you're both enjoying the fresh new look!`,
        `Your experience—and ${petName}'s comfort—are very important to me. If you have any questions or feedback about the groom, coat, or at-home care, please feel free to reach out anytime.`,
        "I'd truly appreciate it if you would take a moment to share a Google review. Your feedback means a lot to us and helps other local pet parents feel confident choosing K9 Atelier.",
      ];
  const closingParagraph = several
    ? `Thank you again for trusting me with ${label}. I look forward to seeing you all again.`
    : `Thank you again for trusting me with ${petName}. I look forward to seeing you both again.`;
  const signoffLines = [
    "K9 Atelier",
    "Private Mobile Pet Spa",
    "Palm Beach",
  ];
  const subject = `Checking in after ${possessive} groom`;
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

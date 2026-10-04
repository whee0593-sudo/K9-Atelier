export const REFERRAL_SOURCE_OPTIONS = [
  { value: "google", label: "Google Search / Google Maps" },
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
  { value: "facebook", label: "Facebook" },
  { value: "yelp", label: "Yelp" },
  { value: "referral", label: "Referred by a friend or client" },
  { value: "van", label: "Saw the K9 Atelier van" },
  { value: "other", label: "Other" },
] as const;

export type ReferralSourceValue =
  (typeof REFERRAL_SOURCE_OPTIONS)[number]["value"];

const REFERRAL_SOURCE_VALUES = new Set<string>(
  REFERRAL_SOURCE_OPTIONS.map((option) => option.value),
);

export function isReferralSourceValue(
  value: string,
): value is ReferralSourceValue {
  return REFERRAL_SOURCE_VALUES.has(value);
}

export function normalizeReferralName(
  source: ReferralSourceValue,
  rawName: unknown,
): string | null {
  if (source !== "referral") return null;
  if (typeof rawName !== "string") return null;
  const trimmed = rawName.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 80);
}

const CODE_TOKEN = /[^A-Z0-9]+/g;

export function normalizeReferralCode(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(CODE_TOKEN, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function referralCodeToken(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function buildReferralCodeBase(input: {
  petName: string;
  ownerFirstName: string;
  ownerLastName: string;
}) {
  const pet = referralCodeToken(input.petName);
  const first = referralCodeToken(input.ownerFirstName);
  const lastInitial = referralCodeToken(input.ownerLastName).slice(0, 1);
  const parts = [pet, first, lastInitial].filter(Boolean);
  return normalizeReferralCode(parts.join("-")) || "K9-GUEST";
}

export function nextReferralCodeCandidate(base: string, attempt: number) {
  const normalized = normalizeReferralCode(base);
  if (attempt <= 1) return normalized;
  return `${normalized}-${attempt}`;
}

export function referralSharePath(code: string) {
  return `/book?ref=${encodeURIComponent(normalizeReferralCode(code))}`;
}

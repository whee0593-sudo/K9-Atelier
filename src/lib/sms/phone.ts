/** Normalize a customer phone number to E.164 for SMS delivery. US numbers assumed. */

export function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

export function normalizePhoneToE164(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const digits = digitsOnly(trimmed);

  if (trimmed.startsWith("+")) {
    if (digits.length >= 8 && digits.length <= 15) return `+${digits}`;
    return null;
  }

  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;

  return null;
}

export function isValidSmsPhone(value: string) {
  return normalizePhoneToE164(value) != null;
}

export function phonesMatch(
  left: string | null | undefined,
  right: string | null | undefined,
) {
  const a = digitsOnly(left ?? "");
  const b = digitsOnly(right ?? "");
  if (a.length < 10 || b.length < 10) return false;
  return a.slice(-10) === b.slice(-10);
}

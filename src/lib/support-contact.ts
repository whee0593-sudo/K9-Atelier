export function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function isValidPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15;
}

export function isValidContact(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return false;
  return isValidEmail(trimmed) || isValidPhone(trimmed);
}

export function normalizeContact(value: string) {
  return value.trim();
}

export const MAX_SUPPORT_PHOTOS = 3;
export const MAX_SUPPORT_PHOTO_BYTES = 4_194_304;

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

export const MAX_SUPPORT_PHOTOS = 5;
export const MAX_SUPPORT_PHOTO_BYTES = 4_194_304;

export const CONTACT_INQUIRY_GENERAL = "general";
export const CONTACT_INQUIRY_CONSULTATION = "grooming-consultation";

export const CONTACT_INQUIRY_TYPES = [
  { value: CONTACT_INQUIRY_GENERAL, label: "General Inquiry" },
  { value: CONTACT_INQUIRY_CONSULTATION, label: "Grooming Consultation" },
] as const;

export type ContactInquiryType =
  (typeof CONTACT_INQUIRY_TYPES)[number]["value"];

export function inquiryTypeFromQuery(value?: string | null): ContactInquiryType {
  return value === CONTACT_INQUIRY_CONSULTATION
    ? CONTACT_INQUIRY_CONSULTATION
    : CONTACT_INQUIRY_GENERAL;
}

export function inquiryTypeLabel(value: string) {
  return (
    CONTACT_INQUIRY_TYPES.find((item) => item.value === value)?.label ??
    "General Inquiry"
  );
}

export const SUPPORT_PHOTO_ACCEPT =
  "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp";

export function isAllowedSupportPhoto(file: File) {
  const type = file.type.toLowerCase();
  if (type === "image/jpeg" || type === "image/png" || type === "image/webp") {
    return true;
  }
  return /\.(jpe?g|png|webp)$/i.test(file.name);
}

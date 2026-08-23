export const OWNER_EMAIL = "penny@k9atelier.com";

export function normalizeStaffEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isOwnerEmail(email?: string | null) {
  return Boolean(email && normalizeStaffEmail(email) === OWNER_EMAIL);
}

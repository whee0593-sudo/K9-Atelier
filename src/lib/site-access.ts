export const SITE_ACCESS_COOKIE = "k9-site-access";

const ACCESS_MESSAGE = "k9-atelier-site-access-v1";

function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqualString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export async function computeSiteAccessToken(password: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    enc.encode(ACCESS_MESSAGE),
  );
  return bufferToHex(signature);
}

export async function isValidSiteAccessCookie(
  cookieValue: string | undefined,
): Promise<boolean> {
  const password = process.env.SITE_ACCESS_PASSWORD;
  if (!password || !cookieValue) return false;
  const expected = await computeSiteAccessToken(password);
  return timingSafeEqualString(cookieValue, expected);
}

export function isPrivacyModeEnabled() {
  if (process.env.SITE_PRIVACY_MODE === "false") return false;
  return true;
}

/** Privacy gate is active when enabled in business.json and a password is configured. */
export function isPrivacyGateActive(privacyModeInConfig: boolean) {
  if (!privacyModeInConfig || !isPrivacyModeEnabled()) return false;

  const password = process.env.SITE_ACCESS_PASSWORD;
  if (password) return true;

  // Local dev without a password: allow full-site preview for the team.
  if (process.env.NODE_ENV === "development") return false;

  // Production without a password: show under-construction only.
  return true;
}

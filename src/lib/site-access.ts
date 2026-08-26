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

/** Server-side team password for privacy / preview mode. */
export function getSiteAccessPassword() {
  return process.env.SITE_ACCESS_PASSWORD?.trim() || undefined;
}

/** Secret token for password-free preview share links. */
export function getPreviewShareToken() {
  return process.env.SITE_PREVIEW_SHARE_TOKEN?.trim() || undefined;
}

export function isValidPreviewShareToken(token: string | undefined) {
  const expected = getPreviewShareToken();
  if (!expected || !token) return false;
  return timingSafeEqualString(token.trim(), expected);
}

export function buildPreviewSharePath(token = getPreviewShareToken()) {
  if (!token) return null;
  return `/preview/${encodeURIComponent(token)}`;
}

export function siteAccessCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  };
}

export async function grantSiteAccessCookie() {
  const password = getSiteAccessPassword();
  if (!password) return null;
  return computeSiteAccessToken(password);
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
  const password = getSiteAccessPassword();
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

  if (getSiteAccessPassword()) return true;

  // Local dev without a password: allow full-site preview for the team.
  if (process.env.NODE_ENV === "development") return false;

  // Production without a password: show under-construction only.
  return true;
}

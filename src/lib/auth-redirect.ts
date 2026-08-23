import { accountConfig } from "@/lib/account-fields";

const ALLOWED_REDIRECT_PATHS = new Set<string>([
  "/account",
  "/account/password",
  "/auth/reset",
  "/account/appointments",
  "/book",
  ...accountConfig.sections.map((section) => section.path),
]);

export function sanitizeAuthRedirect(
  next: string | null | undefined,
  fallback = "/account",
): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return fallback;
  }

  if (next.includes("?") || next.includes("#") || next.includes("..")) {
    return fallback;
  }

  if (next === "/admin" || next.startsWith("/admin/")) {
    return next;
  }

  return ALLOWED_REDIRECT_PATHS.has(next) ? next : fallback;
}

export function getAllowedAuthRedirectPaths(): string[] {
  return [...ALLOWED_REDIRECT_PATHS].sort();
}

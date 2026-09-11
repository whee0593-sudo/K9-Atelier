export const ACCOUNT_FROZEN_MESSAGE =
  "Your account has been frozen. Please contact the administrator at penny@k9atelier.com";

export const FREEZE_BAN_DURATION = "876600h";

export function isFrozenAuthError(message: string) {
  const lower = message.toLowerCase();
  return (
    lower.includes("banned") ||
    lower.includes("frozen") ||
    lower.includes("user is banned")
  );
}

export function isFrozenAuthUser(user: {
  app_metadata?: Record<string, unknown> | null;
  banned_until?: string | null;
} | null) {
  if (!user) return false;
  if (user.app_metadata?.frozen === true) return true;
  if (!user.banned_until) return false;
  const until = Date.parse(user.banned_until);
  return Number.isFinite(until) && until > Date.now();
}

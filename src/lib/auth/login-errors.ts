import {
  ACCOUNT_FROZEN_MESSAGE,
  isFrozenAuthError,
} from "@/lib/auth/frozen-account";

export function authErrorMessage(message: string) {
  if (isFrozenAuthError(message)) {
    return ACCOUNT_FROZEN_MESSAGE;
  }
  const lower = message.toLowerCase();
  if (lower.includes("invalid login")) {
    return "That email or password is incorrect.";
  }
  if (lower.includes("already registered") || lower.includes("already been registered")) {
    return "An account with this email already exists. Sign in, or use the email link if you have not set a password yet.";
  }
  if (lower.includes("email not confirmed")) {
    return "Please confirm your email first. Check your inbox for a confirmation link.";
  }
  return message;
}

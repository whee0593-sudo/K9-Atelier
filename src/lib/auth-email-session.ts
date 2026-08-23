import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

const EMAIL_OTP_TYPES = new Set<string>([
  "email",
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
]);

function urlAuthParams() {
  const url = new URL(window.location.href);
  const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
  return { url, hash, params: url.searchParams };
}

export function isRecoveryAuthLink() {
  if (typeof window === "undefined") return false;
  const { params, hash } = urlAuthParams();
  return params.get("type") === "recovery" || hash.get("type") === "recovery";
}

export function hasEmailAuthTokens() {
  if (typeof window === "undefined") return false;
  const { params, hash } = urlAuthParams();
  return Boolean(
    params.get("code") ||
      params.get("token_hash") ||
      params.get("token") ||
      params.get("type") === "recovery" ||
      hash.get("access_token") ||
      hash.get("token_hash") ||
      hash.get("type") === "recovery",
  );
}

export async function completeEmailAuthFromUrl() {
  const supabase = createClient();
  const { url, hash, params } = urlAuthParams();
  const typeValue = params.get("type") ?? hash.get("type");
  const type = typeValue && EMAIL_OTP_TYPES.has(typeValue)
    ? (typeValue as EmailOtpType)
    : null;
  const recovery =
    type === "recovery" || params.get("next") === "/auth/reset";

  const tokenHash = params.get("token_hash") ?? hash.get("token_hash");
  const code = params.get("code");
  const email = params.get("email");
  const token = params.get("token") ?? hash.get("token");
  const accessToken = hash.get("access_token");
  const refreshToken = hash.get("refresh_token");

  let lastError: Error | null = null;

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });
    if (error) lastError = error;
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) lastError = error;
  } else if (email && token) {
    const { error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: type ?? "email",
    });
    if (error) lastError = error;
  } else if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) lastError = error;
  }

  let {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session && (accessToken || code || tokenHash)) {
    await new Promise((resolve) => window.setTimeout(resolve, 400));
    ({
      data: { session },
    } = await supabase.auth.getSession());
  }

  if (session) {
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
  }

  return {
    error: session ? null : lastError ?? new Error("No session"),
    recovery,
    session,
  };
}

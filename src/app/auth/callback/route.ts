import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { sanitizeAuthRedirect } from "@/lib/auth-redirect";
import { createClient } from "@/lib/supabase/server";

const EMAIL_OTP_TYPES = new Set<string>([
  "email",
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
]);

function redirectToLogin(origin: string) {
  return NextResponse.redirect(new URL("/login?error=auth", origin));
}

function asEmailOtpType(value: string | null): EmailOtpType | null {
  if (!value || !EMAIL_OTP_TYPES.has(value)) return null;
  return value as EmailOtpType;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const type = asEmailOtpType(requestUrl.searchParams.get("type"));
  const next = sanitizeAuthRedirect(
    type === "recovery" ? "/account/password" : requestUrl.searchParams.get("next"),
    type === "recovery" ? "/account/password" : "/account",
  );
  const supabase = await createClient();

  const tokenHash = requestUrl.searchParams.get("token_hash");
  const code = requestUrl.searchParams.get("code");
  const email = requestUrl.searchParams.get("email");
  const token = requestUrl.searchParams.get("token");

  let authError: Error | null = null;

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });
    authError = error;
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    authError = error;
  } else if (email && token) {
    const { error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: type ?? "email",
    });
    authError = error;
  } else {
    return redirectToLogin(requestUrl.origin);
  }

  if (authError) {
    return redirectToLogin(requestUrl.origin);
  }

  return NextResponse.redirect(new URL(next, requestUrl.origin));
}

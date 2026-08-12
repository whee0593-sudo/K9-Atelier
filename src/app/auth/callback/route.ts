import { NextResponse } from "next/server";
import { sanitizeAuthRedirect } from "@/lib/auth-redirect";
import { createClient } from "@/lib/supabase/server";

function redirectToLogin(origin: string) {
  return NextResponse.redirect(new URL("/login?error=auth", origin));
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const next = sanitizeAuthRedirect(requestUrl.searchParams.get("next"));
  const supabase = await createClient();

  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type");
  const code = requestUrl.searchParams.get("code");
  const email = requestUrl.searchParams.get("email");
  const token = requestUrl.searchParams.get("token");

  let authError: Error | null = null;

  if (tokenHash && type === "email") {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: "email",
    });
    authError = error;
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    authError = error;
  } else if (email && token) {
    const { error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: "email",
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

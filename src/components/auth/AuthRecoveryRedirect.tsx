"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { hasEmailAuthTokens, isRecoveryAuthLink } from "@/lib/auth-email-session";

const AUTH_PAGES = new Set(["/auth/callback", "/auth/reset"]);

/** Recovery / magic-link tokens sometimes land on /login or / with a URL hash. */
export function AuthRecoveryRedirect() {
  const pathname = usePathname();

  useEffect(() => {
    if (AUTH_PAGES.has(pathname) || !hasEmailAuthTokens()) {
      return;
    }

    const dest = isRecoveryAuthLink() ? "/auth/reset" : "/auth/callback";
    window.location.replace(
      `${dest}${window.location.search}${window.location.hash}`,
    );
  }, [pathname]);

  return null;
}

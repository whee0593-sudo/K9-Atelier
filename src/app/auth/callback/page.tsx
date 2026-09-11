"use client";

import { useEffect } from "react";
import { completeEmailAuthFromUrl } from "@/lib/auth-email-session";
import { isFrozenAuthUser } from "@/lib/auth/frozen-account";
import { createClient } from "@/lib/supabase/client";
import { sanitizeAuthRedirect } from "@/lib/auth-redirect";
import { Container } from "@/components/luxury/Container";

export default function AuthCallbackPage() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedNext = params.get("next");

    void completeEmailAuthFromUrl().then(async (result) => {
      const recovery =
        result.recovery || requestedNext === "/auth/reset";

      if (result.error || !result.session) {
        window.location.replace(
          recovery ? "/auth/reset" : "/login?error=auth",
        );
        return;
      }

      if (isFrozenAuthUser(result.session.user)) {
        await createClient().auth.signOut();
        window.location.replace("/login?error=frozen");
        return;
      }

      const next = recovery
        ? "/auth/reset"
        : sanitizeAuthRedirect(requestedNext);
      window.location.replace(next);
    });
  }, []);

  return (
    <Container className="py-14 md:py-20">
      <p className="font-body text-center text-sm text-taupe">
        Completing sign-in…
      </p>
    </Container>
  );
}

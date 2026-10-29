"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Container } from "@/components/luxury/Container";
import { createImplicitAuthClient } from "@/lib/auth-implicit";
import { verifySignupLink } from "@/lib/auth/verify-signup";
import { bookingPrimaryBtnClass } from "@/components/booking/booking-ui";

export default function ConfirmEmailPage() {
  const [status, setStatus] = useState<"loading" | "success" | "failed">("loading");
  const verification = useRef<Promise<boolean> | null>(null);

  useEffect(() => {
    // Share the request across Strict Mode effect replays: tokens are single use.
    verification.current ??= verifySignupLink(new URL(window.location.href), createImplicitAuthClient);
    let active = true;
    void verification.current.then((verified) => {
      window.history.replaceState(null, "", "/auth/confirm");
      if (active) setStatus(verified ? "success" : "failed");
    });
    return () => { active = false; };
  }, []);

  return (
    <Container className="py-14 md:py-20">
      <div className="mx-auto max-w-xl text-center">
        <p className="font-body text-sm uppercase tracking-[0.18em] text-ink">K9 Atelier</p>
        <h1 className="font-display mt-4 text-4xl text-ink md:text-5xl">
          {status === "loading" ? "Verifying your email…" : status === "success" ? "Email verified" : "Unable to verify email"}
        </h1>
        <p className="font-body mt-6 text-sm leading-relaxed text-ink" role="status">
          {status === "loading" ? "Please wait while we confirm your email address." : status === "success"
            ? "Your email has been verified. You can now log in with your email and password to complete your profile."
            : "This confirmation link is invalid, has expired, or has already been used. If you have already verified your email, please log in. Otherwise, create your account again to request a new confirmation email."}
        </p>
        {status !== "loading" && <div className="mt-8"><Link href="/login?next=/account/setup" className={bookingPrimaryBtnClass}>Login</Link></div>}
        {status === "failed" && <p className="mt-6"><Link href="/login?mode=signup" className="font-body text-sm text-ink underline">Request a new confirmation email</Link></p>}
      </div>
    </Container>
  );
}

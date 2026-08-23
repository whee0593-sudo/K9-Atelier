"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SetPasswordForm } from "@/components/account/SetPasswordForm";
import { RecoveryCodeForm } from "@/components/auth/RecoveryCodeForm";
import { completeEmailAuthFromUrl } from "@/lib/auth-email-session";
import { createClient } from "@/lib/supabase/client";
import { Container } from "@/components/luxury/Container";

export default function ResetPasswordPage() {
  const [status, setStatus] = useState<"loading" | "ready" | "failed">(
    "loading",
  );

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (
        session &&
        (event === "PASSWORD_RECOVERY" ||
          event === "SIGNED_IN" ||
          event === "INITIAL_SESSION")
      ) {
        setStatus("ready");
      }
    });

    void completeEmailAuthFromUrl().then(async (result) => {
      if (cancelled) return;
      if (result.session) {
        setStatus("ready");
        return;
      }
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      setStatus((current) =>
        current === "ready" || session ? "ready" : "failed",
      );
    });

    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, []);

  return (
    <Container className="py-14 md:py-20">
      <div className="mx-auto max-w-xl">
        <p className="font-body text-[10px] font-medium uppercase tracking-[0.18em] text-taupe">
          Account
        </p>
        <h1 className="font-display mt-4 text-4xl text-ink md:text-5xl">
          Set a new password
        </h1>

        {status === "loading" ? (
          <p className="font-body mt-6 text-sm text-taupe">
            Checking your reset link…
          </p>
        ) : null}

        {status === "failed" ? (
          <div className="mt-6">
            <p className="font-body text-sm text-red-700" role="alert">
              This reset link does not work in this browser. Enter the 6-digit
              code from the email, or request a new reset on this phone.
            </p>
            <RecoveryCodeForm
              onVerified={() => {
                window.location.replace("/auth/reset");
              }}
            />
            <Link
              href="/login"
              className="font-body mt-6 inline-block text-sm text-ink underline"
            >
              Back to sign in
            </Link>
          </div>
        ) : null}

        {status === "ready" ? (
          <div className="mt-8 rounded-2xl border border-lavender/30 bg-cream p-6 md:p-8">
            <SetPasswordForm
              heading="Choose a new password for this account."
              submitLabel="Save new password"
            />
            <p className="font-body mt-6 text-xs text-taupe">
              After saving, you can{" "}
              <Link href="/login?next=/admin" className="underline">
                sign in to staff tools
              </Link>{" "}
              or{" "}
              <Link href="/account" className="underline">
                open your account
              </Link>
              .
            </p>
          </div>
        ) : null}
      </div>
    </Container>
  );
}

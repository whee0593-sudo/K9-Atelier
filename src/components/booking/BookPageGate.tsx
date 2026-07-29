"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { isCustomerLoggedIn } from "@/lib/customer-session";

export function BookPageGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    setLoggedIn(isCustomerLoggedIn());
    setReady(true);
  }, []);

  if (!ready) {
    return (
      <div className="mt-12 text-center text-sm text-text-muted">
        Loading…
      </div>
    );
  }

  if (!loggedIn) {
    return (
      <div className="mt-12 rounded-2xl border border-lavender/40 bg-lavender-light/30 px-6 py-10 text-center">
        <h2 className="text-xl font-medium text-gold-dark">
          Customer login required
        </h2>
        <p className="mt-3 text-sm text-text-muted">
          Please sign in to your account to book an appointment, select your
          pet, and choose a service.
        </p>
        <Link
          href="/login?next=/book"
          className="mt-6 inline-block rounded-2xl bg-gold px-8 py-3 text-sm font-medium text-white transition hover:bg-gold-dark"
        >
          Customer Login
        </Link>
        <p className="mt-6 text-sm text-text-muted">
          New to K9 Atelier?{" "}
          <Link href="/login?next=/book" className="text-gold-dark underline">
            Create an account when sign-up opens
          </Link>
        </p>
      </div>
    );
  }

  return <>{children}</>;
}

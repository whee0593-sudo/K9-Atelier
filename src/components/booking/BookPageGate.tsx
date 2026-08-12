"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { bookingPrimaryBtnClass } from "@/components/booking/booking-ui";

export function BookPageGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getUser().then(({ data: { user } }) => {
      setLoggedIn(Boolean(user));
      setReady(true);
    });
  }, []);

  if (!ready) {
    return (
      <div className="mt-12 text-center text-sm text-taupe">
        Preparing your appointment…
      </div>
    );
  }

  if (!loggedIn) {
    return (
      <div className="mt-12 border border-gray-line/80 bg-dusty-lavender/20 px-6 py-10 text-center md:px-10">
        <p className="font-body text-[10px] font-medium uppercase tracking-[0.18em] text-taupe">
          Private Appointments
        </p>
        <h2 className="font-display mt-4 text-3xl text-ink">
          Welcome to K9 Atelier
        </h2>
        <p className="font-body mx-auto mt-4 max-w-md text-sm leading-relaxed text-taupe">
          Sign in to reserve or manage your dog&apos;s private grooming
          appointment.
        </p>
        <Link href="/login?next=/book" className={`${bookingPrimaryBtnClass} mt-8`}>
          Continue to Your Account
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}

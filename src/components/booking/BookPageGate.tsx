"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BookingPoliciesModal } from "@/components/booking/BookingPoliciesModal";
import { BookingProgress } from "@/components/booking/BookingProgress";
import {
  bookingBackLinkClass,
  bookingNoticeClass,
  bookingPrimaryBtnClass,
} from "@/components/booking/booking-ui";
import { createClient } from "@/lib/supabase/client";

export function BookPageGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [policiesOpen, setPoliciesOpen] = useState(false);
  const policiesTriggerRef = useRef<HTMLButtonElement>(null);

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
      <div className="mx-auto mt-10 max-w-2xl">
        <div className="mt-8 space-y-8">
          <BookingProgress currentStep={1} />

          <section>
            <p className="font-body text-[10px] font-medium uppercase tracking-[0.18em] text-taupe">
              Your Dog
            </p>
            <h2 className="font-display mt-4 text-3xl text-ink md:text-4xl">
              Who Are We Welcoming?
            </h2>
            <p className="font-body mt-4 text-sm text-taupe">
              Select a dog to begin their private appointment.
            </p>
            <div className="mt-8">
              <div className={`${bookingNoticeClass} text-center`}>
                <p className="font-body text-sm text-taupe">
                  No dogs in your profile yet.
                </p>
                <Link
                  href="/login?next=/book"
                  className={`${bookingPrimaryBtnClass} mt-6`}
                >
                  Create My Account
                </Link>
              </div>
            </div>
          </section>

          <div className="border-t border-gray-line/70 pt-6 text-center">
            <p className="font-body text-xs text-taupe">
              Additional care or travel fees may apply where necessary.
            </p>
            <button
              ref={policiesTriggerRef}
              type="button"
              onClick={() => setPoliciesOpen(true)}
              className={`${bookingBackLinkClass} mt-3`}
            >
              View Service Policies
            </button>
            <p className="font-body mt-4 text-xs text-taupe">
              Need help?{" "}
              <Link href="/contact" className="text-ink underline">
                Contact the Atelier
              </Link>
            </p>
          </div>

          <BookingPoliciesModal
            open={policiesOpen}
            onClose={() => setPoliciesOpen(false)}
            returnFocusRef={policiesTriggerRef}
          />
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

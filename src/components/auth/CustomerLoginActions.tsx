"use client";

import { useRouter } from "next/navigation";
import { setCustomerLoggedIn } from "@/lib/customer-session";
import { bookingPrimaryBtnClass } from "@/components/booking/booking-ui";

type Props = {
  next?: string;
  bookingFlow?: boolean;
};

export function CustomerLoginActions({ next, bookingFlow }: Props) {
  const router = useRouter();
  const destination =
    next && next.startsWith("/") && !next.startsWith("//") ? next : "/account";

  function handleCustomerLogin() {
    setCustomerLoggedIn();
    router.push(destination);
  }

  return (
    <div className="mt-10">
      <button
        type="button"
        onClick={handleCustomerLogin}
        className={bookingPrimaryBtnClass}
      >
        Continue to Your Account
      </button>
      {!bookingFlow && (
        <p className="font-body mt-4 text-xs text-taupe">
          Booking a private appointment?{" "}
          <a href="/login?next=/book" className="text-ink underline">
            Continue to booking
          </a>
        </p>
      )}
    </div>
  );
}

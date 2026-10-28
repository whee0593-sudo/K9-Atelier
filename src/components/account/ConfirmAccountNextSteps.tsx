import React from "react";
import Link from "next/link";
import {
  ACCOUNT_SETUP_PATH,
  paymentSetupHref,
} from "@/lib/account-setup";
import {
  bookingPrimaryBtnClass,
  bookingSecondaryBtnClass,
} from "@/components/booking/booking-ui";

export function ConfirmAccountNextSteps(_props: { petId?: string | null; petName?: string | null }) {
  return (
    <div className="mt-6 space-y-5">
      <p className="font-body text-sm leading-relaxed text-ink">
        Your appointment is secured. You are not charged now.
      </p>
      <p className="font-body text-sm leading-relaxed text-taupe">
        Your card is on file for this visit.
      </p>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Link href={ACCOUNT_SETUP_PATH} className={bookingPrimaryBtnClass}>
          Complete your profile
        </Link>
        <Link href={paymentSetupHref()} className={bookingSecondaryBtnClass}>
          Review payment method
        </Link>
      </div>
    </div>
  );
}

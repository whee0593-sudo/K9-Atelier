import React from "react";
import Link from "next/link";
import {
  ACCOUNT_SETUP_PATH,
  paymentSetupHref,
  petsSetupHref,
} from "@/lib/account-setup";
import {
  bookingPrimaryBtnClass,
  bookingSecondaryBtnClass,
} from "@/components/booking/booking-ui";

export function ConfirmAccountNextSteps({
  petId,
  petName,
}: {
  petId?: string | null;
  petName?: string | null;
}) {
  const petLabel = petName?.trim() || "your dog";

  return (
    <div className="mt-6 space-y-5">
      <p className="font-body text-sm leading-relaxed text-ink">
        Your appointment is confirmed. You are not charged now.
      </p>
      <p className="font-body text-sm leading-relaxed text-taupe">
        Next, confirm rabies vaccination status for {petLabel} and add a card on
        file in your account. You may also upload a current rabies certificate
        or vaccination record.
      </p>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Link href={ACCOUNT_SETUP_PATH} className={bookingPrimaryBtnClass}>
          Complete your profile
        </Link>
        <Link href={petsSetupHref(petId)} className={bookingSecondaryBtnClass}>
          Confirm rabies status
        </Link>
        <Link href={paymentSetupHref()} className={bookingSecondaryBtnClass}>
          Add payment method
        </Link>
      </div>
    </div>
  );
}

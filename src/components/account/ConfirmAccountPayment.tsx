"use client";

import React from "react";
import Link from "next/link";
import { bookingSecondaryBtnClass } from "@/components/booking/booking-ui";
import { ACCOUNT_SETUP_PATH } from "@/lib/account-setup";
import { usableConfirmationCards } from "@/lib/staff/customer-confirm-status";
import type { PaymentMethodRecord } from "@/lib/payments/types";

export function ConfirmAccountPayment({ methods }: {
  token: string;
  preview?: boolean;
  methods: PaymentMethodRecord[];
  stripeConfigured?: boolean;
  onChange: (methods: PaymentMethodRecord[]) => void;
}) {
  const usableMethods = usableConfirmationCards(methods);
  return (
    <div className="border border-gray-line/80 bg-ivory p-6">
      <p className="font-body text-[12px] font-medium uppercase tracking-[0.18em] text-taupe">Payment method</p>
      {usableMethods.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {usableMethods.map(method => (
            <li key={method.id} className="font-body text-sm text-ink">
              {method.brand ? method.brand.charAt(0).toUpperCase() + method.brand.slice(1) : "Card"} •••• {method.last4}
              {method.isDefault ? " · Default" : ""}
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-4 font-body text-sm text-taupe">
          <Link href={ACCOUNT_SETUP_PATH} className={bookingSecondaryBtnClass}>Add a card</Link>
          <span> to secure this appointment.</span>
        </div>
      )}
      <p className="font-body mt-3 text-sm leading-relaxed text-taupe">You will not be charged now.</p>
    </div>
  );
}

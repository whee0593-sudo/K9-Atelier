"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { fetchCustomerPaymentMethods } from "@/lib/payments/client";
import { paymentSetupHref } from "@/lib/account-setup";
import { usableConfirmationCards } from "@/lib/staff/customer-confirm-status";

export function AccountSetupPaymentStatus({ hasCard, error }: { hasCard: boolean | null; error: string | null }) {
  return <section className="rounded-2xl border border-lavender/30 bg-cream p-5">
    <h3 className="font-medium text-text">Payment method</h3>
    {error ? <p className="mt-2 text-sm text-red-800" role="alert">{error}</p> :
      <p className="mt-2 text-sm text-text-muted" role="status">{hasCard === null
        ? "Checking saved payment methods…"
        : hasCard ? "Your card is on file. You will not be charged now."
        : "Add a card to secure this appointment. You will not be charged now."}</p>}
    {hasCard !== null || error ? <Link href={paymentSetupHref()} className="mt-4 inline-flex rounded-xl border border-lavender/40 px-4 py-2 text-sm text-text hover:border-gold/40">
      {hasCard === false && !error ? "Add a card" : "Review payment methods"}
    </Link> : null}
  </section>;
}

export function AccountSetupChecklist() {
  const [hasCard, setHasCard] = useState<boolean | null>(null);
  const [cardError, setCardError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    void fetchCustomerPaymentMethods().then(result => {
      if (!cancelled) setHasCard(usableConfirmationCards(result.methods).length > 0);
    }).catch(() => {
      if (!cancelled) setCardError("Could not check saved cards. Please review your payment methods.");
    });
    return () => { cancelled = true; };
  }, []);
  return <AccountSetupPaymentStatus hasCard={hasCard} error={cardError} />;
}

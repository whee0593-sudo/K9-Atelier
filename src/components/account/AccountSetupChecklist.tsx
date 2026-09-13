"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useCustomerPets } from "@/lib/pets/use-customer-pets";
import { fetchCustomerPaymentMethods } from "@/lib/payments/client";
import {
  paymentSetupHref,
  petNeedsVaccinationRecord,
  petsSetupHref,
  readRememberedSetupPetId,
} from "@/lib/account-setup";

export function AccountSetupChecklist() {
  const { pets, loading, error } = useCustomerPets();
  const [hasCard, setHasCard] = useState<boolean | null>(null);
  const [cardError, setCardError] = useState<string | null>(null);
  const [petId, setPetId] = useState<string | null>(null);

  useEffect(() => {
    setPetId(readRememberedSetupPetId());
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetchCustomerPaymentMethods()
      .then((result) => {
        if (!cancelled) setHasCard(result.methods.length > 0);
      })
      .catch(() => {
        if (!cancelled) {
          setHasCard(false);
          setCardError("Could not check saved cards.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const focusPet =
    pets.find((pet) => pet.id === petId) ??
    pets.find(petNeedsVaccinationRecord) ??
    pets[0] ??
    null;
  const vaccineDone = focusPet ? !petNeedsVaccinationRecord(focusPet) : false;
  const paymentDone = hasCard === true;
  const allDone = vaccineDone && paymentDone;

  return (
    <div className="space-y-6">
      <p className="text-sm text-text-muted">
        Your visit is reserved. Upload a current rabies certificate or
        vaccination record, then save a card on file. You are not charged now.
      </p>

      {loading ? (
        <p className="text-sm text-text-muted">Loading your profile…</p>
      ) : null}
      {error ? (
        <p className="text-sm text-red-800" role="alert">
          {error}
        </p>
      ) : null}
      {cardError ? (
        <p className="text-sm text-red-800" role="alert">
          {cardError}
        </p>
      ) : null}

      {allDone ? (
        <p className="rounded-xl border border-lavender/40 bg-lavender-light/40 px-4 py-3 text-sm text-text">
          Vaccination and payment details are on file. Thank you.
        </p>
      ) : null}

      <ol className="space-y-4">
        <li className="rounded-2xl border border-lavender/30 bg-cream p-5">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-gold-dark">
            Step 1
          </p>
          <h3 className="mt-2 font-medium text-text">Vaccination record</h3>
          <p className="mt-2 text-sm text-text-muted">
            {focusPet
              ? `Upload a current record for ${focusPet.name}.`
              : "Open your pet profile and upload a current record."}
            {vaccineDone ? " A record is already on file." : ""}
          </p>
          <Link
            href={petsSetupHref(focusPet?.id ?? petId)}
            className="mt-4 inline-flex rounded-xl bg-gold px-4 py-2 text-sm font-medium text-white hover:bg-gold-dark"
          >
            {vaccineDone ? "Review pet profile" : "Add vaccination record"}
          </Link>
        </li>
        <li className="rounded-2xl border border-lavender/30 bg-cream p-5">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-gold-dark">
            Step 2
          </p>
          <h3 className="mt-2 font-medium text-text">Payment method</h3>
          <p className="mt-2 text-sm text-text-muted">
            Save a card for after the visit. You are not charged when you add
            it.
            {paymentDone ? " A card is already on file." : ""}
          </p>
          <Link
            href={paymentSetupHref()}
            className="mt-4 inline-flex rounded-xl border border-lavender/40 px-4 py-2 text-sm text-text hover:border-gold/40"
          >
            {paymentDone ? "Review payment methods" : "Add payment method"}
          </Link>
        </li>
      </ol>
    </div>
  );
}

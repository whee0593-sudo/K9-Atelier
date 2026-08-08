"use client";

import { useEffect, useRef } from "react";
import { business } from "@/lib/business";
import { bookingSecondaryBtnClass } from "@/components/booking/booking-ui";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function BookingPoliciesModal({ open, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const { booking, serviceArea } = business;
  const cancellation = booking.cancellationPolicy;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="booking-policies-title"
      onClick={onClose}
    >
      <div
        className="max-h-[min(90vh,720px)] w-full max-w-2xl overflow-y-auto rounded-sm border border-gray-line bg-ivory p-6 shadow-lg sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="font-body text-[10px] font-medium uppercase tracking-[0.18em] text-taupe">
          Service Policies
        </p>
        <h2
          id="booking-policies-title"
          className="font-display mt-3 text-3xl text-ink"
        >
          Policies &amp; Fees
        </h2>

        <div className="mt-8 space-y-8 text-sm leading-relaxed text-taupe">
          <section>
            <h3 className="font-body text-[11px] font-semibold uppercase tracking-[0.14em] text-ink">
              Travel Policy
            </h3>
            <p className="mt-3">
              Complimentary travel within {serviceArea.freeRadiusMiles} miles of
              our base. Between {serviceArea.freeRadiusMiles}–
              {serviceArea.maxDistanceMiles} miles, $
              {serviceArea.travelFeePerMile} per one-way mile applies (GPS
              driving distance). Appointments beyond {serviceArea.maxDistanceMiles}{" "}
              miles may be considered by request.
            </p>
          </section>

          <section>
            <h3 className="font-body text-[11px] font-semibold uppercase tracking-[0.14em] text-ink">
              Cancellation Policy
            </h3>
            <p className="mt-3">{cancellation.intro}</p>
          </section>

          <section>
            <h3 className="font-body text-[11px] font-semibold uppercase tracking-[0.14em] text-ink">
              Deposit &amp; Payment
            </h3>
            <p className="mt-3">{booking.paymentMethodNote}</p>
            <p className="mt-3">{booking.newClientDepositNotice}</p>
          </section>

          {business.fees.map((fee) => (
            <section key={fee.id}>
              <h3 className="font-body text-[11px] font-semibold uppercase tracking-[0.14em] text-ink">
                {fee.name}
              </h3>
              <p className="mt-3">{fee.description}</p>
            </section>
          ))}
        </div>

        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className={`${bookingSecondaryBtnClass} mt-8`}
        >
          Close
        </button>
      </div>
    </div>
  );
}

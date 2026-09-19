import React from "react";
import { BOOKING_STEPS } from "@/lib/booking-flow";

type Props = {
  currentStep: number;
};

export function BookingProgress({ currentStep }: Props) {
  return (
    <nav
      aria-label="Booking progress"
      className="border-b border-gray-line/70 pb-6"
    >
      <ol className="flex flex-wrap gap-x-4 gap-y-3">
        {BOOKING_STEPS.map((step) => {
          const completed = currentStep > step.id;
          const current = currentStep === step.id;

          return (
            <li
              key={step.id}
              className={`font-body text-[10px] font-medium uppercase tracking-[0.14em] ${
                completed
                  ? "text-champagne"
                  : current
                    ? "text-ink"
                    : "text-taupe"
              }`}
            >
              <span className="hidden sm:inline">{step.label}</span>
              <span className="sm:hidden">{step.short}</span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

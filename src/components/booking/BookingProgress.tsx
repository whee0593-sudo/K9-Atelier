import React from "react";
import { BOOKING_STEPS } from "@/lib/booking-flow";

type Props = {
  currentStep: number;
};

export function BookingProgress({ currentStep }: Props) {
  const step =
    BOOKING_STEPS.find((item) => item.id === currentStep) ?? BOOKING_STEPS[0];
  // Only the opening overview omits card setup; all six actual steps remain.
  const openingOverview = currentStep === 1;
  const visibleSteps = openingOverview
    ? BOOKING_STEPS.filter((item) => item.id !== 5)
    : BOOKING_STEPS;
  const total = visibleSteps.length;
  const progress = Math.min(Math.max(currentStep, 1), total) / total;

  return (
    <nav
      aria-label="Booking progress"
      className="border-b border-gray-line/70 pb-6"
    >
      <div className="sm:hidden">
        <p className="font-body text-[12px] font-medium uppercase tracking-[0.16em] text-taupe">
          Step {step.id} of {total}
        </p>
        <p className="font-body mt-2 text-[12px] font-medium uppercase tracking-[0.14em] text-ink">
          {step.short}
        </p>
        <div
          className="mt-4 h-[2px] overflow-hidden bg-dusty-lavender/70"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={total}
          aria-valuenow={step.id}
          aria-label={`Step ${step.id} of ${total}`}
        >
          <div
            className="h-full bg-champagne"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      </div>

      <ol className="hidden flex-wrap gap-x-4 gap-y-3 sm:flex">
        {visibleSteps.map((item, index) => {
          const completed = currentStep > item.id;
          const current = currentStep === item.id;

          return (
            <li
              key={item.id}
              className={`font-body text-[12px] font-medium uppercase tracking-[0.14em] ${
                completed
                  ? "text-champagne"
                  : current
                    ? "text-ink"
                    : "text-taupe"
              }`}
            >
              {openingOverview ? `${String(index + 1).padStart(2, "0")} ${item.short}` : item.label}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

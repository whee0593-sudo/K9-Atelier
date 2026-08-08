"use client";

import { useEffect, useRef } from "react";
import {
  business,
  formatPrice,
  getPaymentFaqParagraphs,
  getServiceAreaFaqParagraphs,
} from "@/lib/business";
import { bookingSecondaryBtnClass } from "@/components/booking/booking-ui";

type Props = {
  open: boolean;
  onClose: () => void;
};

const tableWrapClass =
  "mt-3 overflow-hidden border border-gray-line/80 text-sm";
const thClass =
  "px-4 py-3 font-body text-[11px] font-medium uppercase tracking-[0.12em] text-taupe";
const tdClass = "border-t border-gray-line/60 px-4 py-3 text-taupe";

function FeePriceDetails({ fee }: { fee: (typeof business.fees)[number] }) {
  const f = fee as Record<string, unknown>;
  const seniorCare = f.seniorCare as
    | {
        name: string;
        description: string;
        suitableFor: string;
        tiers: Array<{ weightTier: string; priceFrom: number }>;
      }
    | undefined;

  const weightLabels = Object.fromEntries(
    business.weightTiers.map((tier) => [tier.id, tier.label]),
  );

  return (
    <>
      {typeof f.rateMin === "number" && (
        <div className={tableWrapClass}>
          <table className="w-full text-left">
            <thead className="bg-dusty-lavender/35">
              <tr>
                <th className={thClass}>Fee Range</th>
                <th className={thClass}>Condition</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className={tdClass}>
                  +{formatPrice(f.rateMin as number)} –{" "}
                  {formatPrice(
                    typeof f.rateMax === "number"
                      ? (f.rateMax as number)
                      : (f.rateMin as number),
                  )}
                  +
                </td>
                <td className={tdClass}>
                  Based on level of anxiety, resistance, or aggression shown
                  on-site
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {Array.isArray(f.lineItems) && (
        <div className={tableWrapClass}>
          <table className="w-full text-left">
            <thead className="bg-dusty-lavender/35">
              <tr>
                <th className={thClass}>Fee Item</th>
                <th className={thClass}>Cost</th>
                <th className={thClass}>Policy</th>
              </tr>
            </thead>
            <tbody>
              {(
                f.lineItems as Array<{
                  name: string;
                  rate: number;
                  note?: string;
                }>
              ).map((item) => (
                <tr key={item.name}>
                  <td className={tdClass}>{item.name}</td>
                  <td className={`${tdClass} font-medium text-ink`}>
                    {formatPrice(item.rate)}
                  </td>
                  <td className={tdClass}>{item.note ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {seniorCare && (
        <div className="mt-4 border-t border-gray-line/60 pt-4">
          <p className="font-body text-[11px] font-semibold uppercase tracking-[0.14em] text-ink">
            {seniorCare.name}
          </p>
          <p className="mt-2">{seniorCare.description}</p>
          <div className={tableWrapClass}>
            <table className="w-full text-left">
              <thead className="bg-dusty-lavender/35">
                <tr>
                  <th className={thClass}>Weight</th>
                  <th className={thClass}>Additional Fee</th>
                </tr>
              </thead>
              <tbody>
                {seniorCare.tiers.map((tier) => (
                  <tr key={tier.weightTier}>
                    <td className={tdClass}>
                      {weightLabels[tier.weightTier] ?? tier.weightTier}
                    </td>
                    <td className={`${tdClass} font-medium text-ink`}>
                      +{formatPrice(tier.priceFrom)} (Added to base bath or
                      grooming price)
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2">
            <span className="font-medium text-ink">Suitable for: </span>
            {seniorCare.suitableFor}
          </p>
        </div>
      )}

      {fee.type === "travel" &&
        "rate" in fee &&
        typeof fee.rate === "number" && (
          <div className={tableWrapClass}>
            <table className="w-full text-left">
              <thead className="bg-dusty-lavender/35">
                <tr>
                  <th className={thClass}>Rate Structure</th>
                  <th className={thClass}>Calculation Method</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className={tdClass}>
                    {formatPrice(fee.rate)} / one-way mile
                  </td>
                  <td className={tdClass}>
                    Measured from base location to client address
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
    </>
  );
}

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

  const cancellation = business.booking.cancellationPolicy;
  const policyFees = business.fees.filter((fee) => fee.id !== "travel-fee");

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
              Payment &amp; Deposits
            </h3>
            <div className="mt-3 space-y-3">
              {getPaymentFaqParagraphs().map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </section>

          <section>
            <h3 className="font-body text-[11px] font-semibold uppercase tracking-[0.14em] text-ink">
              {cancellation.title}
            </h3>
            <p className="mt-3">{cancellation.intro}</p>
            {cancellation.sections.map((section) => {
              const table = "table" in section ? section.table : undefined;
              return (
                <div key={section.heading} className="mt-5">
                  <p className="font-body text-[11px] font-semibold uppercase tracking-[0.12em] text-ink">
                    {section.heading}
                  </p>
                  <p className="mt-2">{section.body}</p>
                  {table && (
                    <div className={tableWrapClass}>
                      <table className="w-full text-left">
                        <thead className="bg-dusty-lavender/35">
                          <tr>
                            {table.columns.map((col) => (
                              <th key={col} className={thClass}>
                                {col}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {table.rows.map((row) => (
                            <tr key={row.join("|")}>
                              {row.map((cell, cellIndex) => (
                                <td key={cellIndex} className={tdClass}>
                                  {cell}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
            <p className="mt-4">{cancellation.outro}</p>
          </section>

          <section>
            <h3 className="font-body text-[11px] font-semibold uppercase tracking-[0.14em] text-ink">
              Service Area &amp; Travel
            </h3>
            <div className="mt-3 space-y-3">
              {getServiceAreaFaqParagraphs().map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </section>

          {policyFees.map((fee) => (
            <section key={fee.id}>
              <h3 className="font-body text-[11px] font-semibold uppercase tracking-[0.14em] text-ink">
                {fee.name}
              </h3>
              <p className="mt-3">{fee.description}</p>
              <FeePriceDetails fee={fee} />
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

import React from "react";
import {
  BOOKING_PRICE_DISCLAIMER,
  formatReviewMoney,
  type BookingPriceQuote,
} from "@/lib/booking-price";

function serviceAmount(quote: BookingPriceQuote) {
  if (quote.servicePriceLabel === "Complimentary") return "Complimentary";
  const money = formatReviewMoney(quote.servicePrice);
  return quote.pricingBasis === "hourly" ? `${money}/hour` : money;
}

export function BookingReviewQuote({ quote }: { quote: BookingPriceQuote }) {
  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="flex items-baseline justify-between gap-4">
          <span className="font-body text-sm text-ink">{quote.serviceName}</span>
          <span className="font-body text-sm text-ink">{serviceAmount(quote)}</span>
        </div>
        {quote.estimateNote ? (
          <p className="font-body text-sm leading-relaxed text-taupe">
            {quote.estimateNote}
          </p>
        ) : null}
        {quote.addOns.map((item) => (
          <div key={item.id} className="flex items-baseline justify-between gap-4">
            <span className="font-body text-sm text-ink">{item.name}</span>
            <span className="font-body text-sm text-ink">
              {formatReviewMoney(item.price)}
            </span>
          </div>
        ))}
        {quote.assessedAddOns.map((item) => (
          <div key={item.id}>
            <p className="font-body text-sm text-ink">{item.name}</p>
            <p className="font-body mt-2 text-sm leading-relaxed text-taupe">
              {item.note}
            </p>
          </div>
        ))}
        <div className="flex items-baseline justify-between gap-4">
          <span className="font-body text-sm text-ink">Travel Fee</span>
          <span className="font-body text-sm text-ink">
            {formatReviewMoney(quote.travelFee)}
          </span>
        </div>
        <div className="flex items-baseline justify-between gap-4 border-t border-gray-line/70 pt-4">
          <span className="font-body text-sm font-medium text-ink">
            Estimated Total
          </span>
          <span className="font-display text-2xl text-ink">
            {formatReviewMoney(quote.estimatedTotal)}
          </span>
        </div>
        {quote.assessmentExclusionNote ? (
          <p className="font-body text-sm leading-relaxed text-taupe">
            {quote.assessmentExclusionNote}
          </p>
        ) : null}
      </div>

      <div>
        <p className="font-body text-[12px] font-medium uppercase tracking-[0.18em] text-taupe">
          Pricing Notice
        </p>
        <p className="font-body mt-3 text-sm leading-relaxed text-taupe">
          {BOOKING_PRICE_DISCLAIMER}
        </p>
      </div>
    </div>
  );
}

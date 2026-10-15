import React from "react";
import type { BookingPriceQuote } from "@/lib/booking-price";

function PriceRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-taupe">{label}</span>
      <span className="text-right text-ink">{value}</span>
    </div>
  );
}

export function BookingPriceLines({ quote }: { quote: BookingPriceQuote }) {
  return (
    <div className="space-y-3 text-sm">
      <PriceRow label="Selected Service" value={quote.serviceName} />
      <PriceRow label="Estimated Service Price" value={quote.servicePriceLabel} />
      {quote.estimateNote ? (
        <p className="font-body text-xs leading-relaxed text-taupe">
          {quote.estimateNote}
        </p>
      ) : null}
      <PriceRow label="Add-On Care" value={quote.addOnLabel} />
      <PriceRow label="Travel Fee" value={quote.travelFeeLabel} />
      <div className="flex justify-between gap-4 pt-2">
        <span className="font-medium text-ink">Estimated Total</span>
        <span className="font-display text-right text-2xl text-ink">
          {quote.totalLabel}
        </span>
      </div>
    </div>
  );
}

import React from "react";
import type { BookingDogService } from "@/lib/booking/dogs";
import { formatReviewMoney, type BookingPriceQuote } from "@/lib/booking-price";
import { bookingNoticeClass } from "@/components/booking/booking-ui";

function PriceRow({ name, amount }: { name: string; amount: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 font-semibold">
      <span className="min-w-0 break-words">{name}</span>
      <span className="shrink-0 text-right tabular-nums">{amount}</span>
    </div>
  );
}

export function BookingGroupReviewQuote({ dogs, quotes }: {
  dogs: BookingDogService[];
  quotes: (BookingPriceQuote | null)[];
}) {
  const ready = dogs.length > 0 && dogs.every((_, index) => quotes[index] != null);
  const total = quotes.reduce((sum, quote) => sum + (quote?.estimatedTotal ?? 0), 0);
  const travelFee = quotes.reduce((sum, quote) => sum + (quote?.travelFee ?? 0), 0);

  return (
    <>
      <div className={`${bookingNoticeClass} mt-6 space-y-8 font-body text-sm text-ink`}>
        {dogs.map((dog, index) => {
          const quote = quotes[index];
          const serviceAmount = !quote ? "" : quote.servicePriceLabel === "Complimentary"
            ? "Complimentary"
            : `${formatReviewMoney(quote.servicePrice)}${quote.pricingBasis === "hourly" ? "/hour" : ""}`;
          return (
            <article key={dog.pet.id} className="space-y-4">
              <h3 className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="font-display break-words text-2xl font-semibold">{dog.pet.name}</span>
                <span className="text-taupe">{dog.pet.breed} · {dog.pet.weightLbs} lbs</span>
              </h3>
              {quote ? (
                <div className="space-y-4">
                  <PriceRow name={quote.serviceName} amount={serviceAmount} />
                  {quote.addOns.map((item) => (
                    <PriceRow key={item.id} name={item.name} amount={formatReviewMoney(item.price)} />
                  ))}
                  {quote.assessedAddOns.map((item) => (
                    <div key={item.id}>
                      <p className="font-semibold">{item.name}</p>
                      <p className="mt-2 leading-relaxed text-taupe">{item.note}</p>
                    </div>
                  ))}
                  {quote.assessmentExclusionNote ? (
                    <p className="leading-relaxed text-taupe">{quote.assessmentExclusionNote}</p>
                  ) : null}
                </div>
              ) : (
                <p role="alert">Please check this dog&apos;s service and weight.</p>
              )}
            </article>
          );
        })}
        {ready && travelFee > 0 ? (
          <PriceRow name="Travel Fee" amount={formatReviewMoney(travelFee)} />
        ) : null}
        {ready ? (
          <div className="flex items-baseline justify-between gap-4 border-t border-gray-line/70 pt-6 font-semibold">
            <span>Estimated Total</span>
            <span className="shrink-0 text-right tabular-nums">{formatReviewMoney(total)}</span>
          </div>
        ) : null}
      </div>
      <div className="font-body mt-5 text-sm leading-relaxed text-taupe">
        <p className="font-semibold text-ink">Pricing Notice</p>
        <p className="mt-2">
          Final pricing may vary depending on coat condition, matting, additional handling needs, and any adjustments discussed with your groomer.
        </p>
      </div>
    </>
  );
}

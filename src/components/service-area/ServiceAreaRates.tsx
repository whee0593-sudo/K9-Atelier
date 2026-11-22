import { business, formatPrice } from "@/lib/business";
import { calculateTravelFee } from "@/lib/travel";

export function ServiceAreaRates({ showPrices = false }: { showPrices?: boolean }) {
  const { serviceArea } = business;

  return (
    <>
      <div className="mt-10 grid gap-6 md:grid-cols-3">
        <div className="rounded-2xl border border-lavender/30 bg-lavender-light/40 p-6">
          <p className="text-3xl font-semibold text-gold-dark">
            {serviceArea.freeRadiusMiles} mi
          </p>
          <p className="mt-2 text-sm text-text-muted">Included travel</p>
        </div>
        <div className="rounded-2xl border border-lavender/30 bg-lavender-light/40 p-6">
          <p className="text-3xl font-semibold text-gold-dark">
            {showPrices
              ? formatPrice(serviceArea.travelFeePerMile)
              : `${serviceArea.freeRadiusMiles}–${serviceArea.standardServiceMiles}`}
          </p>
          <p className="mt-2 text-sm text-text-muted">
            {showPrices
              ? `Per one-way driving mile beyond the first ${serviceArea.freeRadiusMiles}, through ${serviceArea.standardServiceMiles} miles`
              : `Miles where a travel fee may apply. The amount is shown when you confirm.`}
          </p>
        </div>
        <div className="rounded-2xl border border-lavender/30 bg-lavender-light/40 p-6">
          <p className="text-3xl font-semibold text-gold-dark">
            Over {serviceArea.standardServiceMiles} mi
          </p>
          <p className="mt-2 text-sm text-text-muted">Contact the studio</p>
        </div>
      </div>

      {showPrices ? (
        <div className="mt-10 rounded-2xl border border-lavender/30 bg-cream p-6">
          <h2 className="text-lg font-medium text-text">Examples</h2>
          {[14, 22].map((miles) => {
            const quote = calculateTravelFee(miles);
            return (
              <p key={miles} className="mt-3 text-sm text-text-muted">
                {miles} miles: {quote.billableMiles} billable miles ×{" "}
                {formatPrice(serviceArea.travelFeePerMile)} ={" "}
                <strong>{formatPrice(quote.fee)}</strong>.
              </p>
            );
          })}
          <p className="mt-3 text-sm text-text-muted">
            Partial billable miles round up. Beyond{" "}
            {serviceArea.standardServiceMiles} miles, please contact us. Online
            booking is not available.
          </p>
        </div>
      ) : (
        <div className="mt-10 rounded-2xl border border-lavender/30 bg-cream p-6">
          <h2 className="text-lg font-medium text-text">Travel fee</h2>
          <p className="mt-3 text-sm text-text-muted">
            Travel within {serviceArea.freeRadiusMiles} miles is included. Farther
            visits may include a travel fee, shown with the estimate when you
            confirm the appointment. Beyond {serviceArea.standardServiceMiles}{" "}
            miles, please contact us. Online booking is not available.
          </p>
        </div>
      )}
    </>
  );
}

import { business, formatPrice } from "@/lib/business";

export function ServiceAreaRates({ showPrices = false }: { showPrices?: boolean }) {
  const { serviceArea } = business;
  const standardTravelPortion =
    (serviceArea.maxDistanceMiles - serviceArea.freeRadiusMiles) *
    serviceArea.travelFeePerMile;

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
              : `${serviceArea.freeRadiusMiles}–${serviceArea.maxDistanceMiles}`}
          </p>
          <p className="mt-2 text-sm text-text-muted">
            {showPrices
              ? `Per mile from ${serviceArea.freeRadiusMiles} to ${serviceArea.maxDistanceMiles} miles`
              : `Miles where a travel fee may apply. The amount is shown when you confirm.`}
          </p>
        </div>
        <div className="rounded-2xl border border-lavender/30 bg-lavender-light/40 p-6">
          <p className="text-3xl font-semibold text-gold-dark">
            {showPrices
              ? formatPrice(serviceArea.extendedTravelFeePerMile)
              : `${serviceArea.maxDistanceMiles}–${serviceArea.standardServiceMiles}`}
          </p>
          <p className="mt-2 text-sm text-text-muted">
            {showPrices
              ? `Per mile from ${serviceArea.maxDistanceMiles} to ${serviceArea.standardServiceMiles} miles`
              : "Miles where an extended travel fee may apply."}
          </p>
        </div>
      </div>

      {showPrices ? (
        <div className="mt-10 rounded-2xl border border-lavender/30 bg-cream p-6">
          <h2 className="text-lg font-medium text-text">Examples</h2>
          <p className="mt-3 text-sm text-text-muted">
            14 miles: 4 miles beyond the free zone ×{" "}
            {formatPrice(serviceArea.travelFeePerMile)} = <strong>$26</strong>.
          </p>
          <p className="mt-3 text-sm text-text-muted">
            22 miles: {formatPrice(standardTravelPortion)} through{" "}
            {serviceArea.maxDistanceMiles} miles, plus 2 ×{" "}
            {formatPrice(serviceArea.extendedTravelFeePerMile)} = <strong>$85</strong>.
          </p>
          <p className="mt-3 text-sm text-text-muted">
            Fees are rounded to the nearest dollar. Beyond{" "}
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

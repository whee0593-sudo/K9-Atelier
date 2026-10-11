import { formatHourLabel } from "@/lib/appointments/closures";
import { business, formatPrice } from "@/lib/business";

export default function ServiceAreaPage() {
  const { serviceArea, booking } = business;
  const hoursLabel = `${formatHourLabel(
    Number(booking.hoursStart.split(":")[0]),
  )} – ${formatHourLabel(Number(booking.hoursEnd.split(":")[0]))}`;

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="text-3xl font-semibold text-gold-dark">Service Area</h1>
      <p className="mt-3 max-w-2xl text-text-muted">
        K9 Atelier is a mobile grooming service — we bring the salon to your
        doorstep
        {serviceArea.publicBaseLabel
          ? ` from the ${serviceArea.publicBaseLabel}`
          : ""}
        .
      </p>

      <div className="mt-10 grid gap-6 md:grid-cols-3">
        <div className="rounded-2xl border border-lavender/30 bg-lavender-light/40 p-6">
          <p className="text-3xl font-semibold text-gold-dark">
            {serviceArea.freeRadiusMiles} mi
          </p>
          <p className="mt-2 text-sm text-text-muted">Free travel zone</p>
        </div>
        <div className="rounded-2xl border border-lavender/30 bg-lavender-light/40 p-6">
          <p className="text-3xl font-semibold text-gold-dark">
            {formatPrice(serviceArea.travelFeePerMile)}
          </p>
          <p className="mt-2 text-sm text-text-muted">
            Per mile from {serviceArea.freeRadiusMiles} to {serviceArea.maxDistanceMiles}{" "}
            miles
          </p>
        </div>
        <div className="rounded-2xl border border-lavender/30 bg-lavender-light/40 p-6">
          <p className="text-3xl font-semibold text-gold-dark">
            {formatPrice(serviceArea.extendedTravelFeePerMile)}
          </p>
          <p className="mt-2 text-sm text-text-muted">
            Per mile from {serviceArea.maxDistanceMiles} to {serviceArea.standardServiceMiles}{" "}
            miles
          </p>
        </div>
      </div>

      <div className="mt-10 rounded-2xl border border-lavender/30 bg-cream p-6">
        <h2 className="text-lg font-medium text-text">Examples</h2>
        <p className="mt-3 text-sm text-text-muted">
          14 miles: 4 miles beyond the free zone ×{" "}
          {formatPrice(serviceArea.travelFeePerMile)} = <strong>$26</strong>.
        </p>
        <p className="mt-3 text-sm text-text-muted">
          22 miles: {formatPrice(
            (serviceArea.maxDistanceMiles - serviceArea.freeRadiusMiles) *
              serviceArea.travelFeePerMile,
          )}{" "}
          through {serviceArea.maxDistanceMiles} miles, plus 2 ×{" "}
          {formatPrice(serviceArea.extendedTravelFeePerMile)} = <strong>$85</strong>.
        </p>
        <p className="mt-3 text-sm text-text-muted">
          Fees are rounded to the nearest dollar. Beyond{" "}
          {serviceArea.standardServiceMiles} miles, please contact us. Online
          booking is not available.
        </p>
      </div>

      <div className="mt-10 rounded-2xl border border-blue/40 bg-blue/10 p-6">
        <h2 className="text-lg font-medium text-text">Booking Hours</h2>
        <p className="mt-3 text-sm text-text-muted">
          Monday – Friday, {hoursLabel}
        </p>
        <p className="mt-2 text-sm text-text-muted">
          {booking.paymentMethodNote}
        </p>
      </div>
    </div>
  );
}

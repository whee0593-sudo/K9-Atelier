import { business } from "@/lib/business";

export default function ServiceAreaPage() {
  const { serviceArea, booking } = business;

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
            ${serviceArea.travelFeePerMile}
          </p>
          <p className="mt-2 text-sm text-text-muted">Per one-way mile beyond free zone</p>
        </div>
        <div className="rounded-2xl border border-lavender/30 bg-lavender-light/40 p-6">
          <p className="text-3xl font-semibold text-gold-dark">
            {serviceArea.maxDistanceMiles} mi
          </p>
          <p className="mt-2 text-sm text-text-muted">Maximum service distance</p>
        </div>
      </div>

      <div className="mt-10 rounded-2xl border border-lavender/30 bg-cream p-6">
        <h2 className="text-lg font-medium text-text">Example</h2>
        <p className="mt-3 text-sm text-text-muted">
          If your address is 14 miles away: 4 miles beyond the free zone × $
          {serviceArea.travelFeePerMile} = <strong>$26.00</strong> travel fee
          added to your service.
        </p>
      </div>

      <div className="mt-10 rounded-2xl border border-blue/40 bg-blue/10 p-6">
        <h2 className="text-lg font-medium text-text">Booking Hours</h2>
        <p className="mt-3 text-sm text-text-muted">
          Monday – Friday, {booking.hoursStart} – {booking.hoursEnd}
        </p>
        <p className="mt-2 text-sm text-text-muted">
          {booking.paymentMethodNote}
        </p>
      </div>
    </div>
  );
}

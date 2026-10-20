import { formatHourLabel } from "@/lib/appointments/closures";
import { ServiceAreaRates } from "@/components/service-area/ServiceAreaRates";
import { business } from "@/lib/business";
import { viewerCanViewServicePrices } from "@/lib/pricing-access";

export default async function ServiceAreaPage() {
  const showPrices = await viewerCanViewServicePrices();
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

      <ServiceAreaRates showPrices={showPrices} />

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

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
      <h1 className="text-3xl font-semibold text-deep-lavender">Service Area</h1>

      <ServiceAreaRates showPrices={showPrices} />

      <div className="mt-10 rounded-2xl border border-blue/40 bg-blue/10 p-6">
        <h2 className="text-lg font-medium text-text">Booking Hours</h2>
        <p className="mt-3 text-base text-ink">
          Monday – Friday, {hoursLabel}
        </p>
      </div>
    </div>
  );
}

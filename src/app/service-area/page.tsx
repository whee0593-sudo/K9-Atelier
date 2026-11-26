import type { Metadata } from "next";
import Link from "next/link";
import { formatHourLabel } from "@/lib/appointments/closures";
import { ServiceAreaRates } from "@/components/service-area/ServiceAreaRates";
import { business, getCommunitiesServed } from "@/lib/business";
import { viewerCanViewServicePrices } from "@/lib/pricing-access";
import { absoluteSiteUrl } from "@/lib/service-page";

export const metadata: Metadata = {
  title: "Mobile Dog Grooming Service Area | K9 Atelier",
  description:
    "Private mobile dog grooming in Palm Beach Gardens, Jupiter, Tequesta, Jupiter Island, Palm Beach and West Palm Beach. Check travel and booking details.",
  alternates: { canonical: absoluteSiteUrl("/service-area") },
};

export default async function ServiceAreaPage() {
  const showPrices = await viewerCanViewServicePrices();
  const { serviceArea, booking } = business;
  const hoursLabel = `${formatHourLabel(
    Number(booking.hoursStart.split(":")[0]),
  )} – ${formatHourLabel(Number(booking.hoursEnd.split(":")[0]))}`;

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="text-3xl font-semibold text-deep-lavender">Mobile Dog Grooming Service Area</h1>
      <p className="mt-4 text-ink">
        K9 Atelier brings private, cage-free grooming to your doorstep for dogs up to 45 lbs.
        Every appointment is one-on-one and paced for your dog.
      </p>
      <ul className="my-6 grid list-disc gap-2 pl-5 text-ink sm:grid-cols-2">
        {getCommunitiesServed().map((community) => <li key={community}>{community}</li>)}
      </ul>
      <p className="mb-8 text-ink">
        Availability depends on your exact address.{" "}
        <Link href="/book" className="underline">Check availability</Link>{" "}
        or <Link href="/contact" className="underline">contact us</Link> about your location.
      </p>

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

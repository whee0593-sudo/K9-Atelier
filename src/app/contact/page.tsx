import { BookServiceLink } from "@/components/booking/BookServiceLink";
import { LuxuryButton } from "@/components/luxury/LuxuryButton";
import { PageShell } from "@/components/luxury/PageShell";
import { business } from "@/lib/business";

export const metadata = {
  title: "Contact · K9 Atelier",
  description:
    "Contact K9 Atelier for private mobile dog grooming in Palm Beach — email, Instagram, service area and booking hours.",
};

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatTime(value: string) {
  const [hStr, mStr] = value.split(":");
  const hour = Number(hStr);
  const minute = mStr ?? "00";
  const period = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${minute} ${period}`;
}

export default function ContactPage() {
  const { brand, booking, serviceArea, site } = business;

  const days = booking.availableDays;
  const daysLabel =
    days.length > 1
      ? `${capitalize(days[0])} – ${capitalize(days[days.length - 1])}`
      : capitalize(days[0] ?? "");
  const hoursLabel = `${formatTime(booking.hoursStart)} – ${formatTime(
    booking.hoursEnd,
  )}`;
  const instagramUrl =
    site.underConstruction?.instagramUrl ?? "https://instagram.com/k9atelierfl";
  const instagramHandle =
    site.underConstruction?.instagramHandle ?? "k9atelierfl";

  return (
    <PageShell
      eyebrow="Get in Touch"
      title={
        <>
          A Private Appointment
          <br />
          Starts With a Conversation.
        </>
      }
      intro="Questions about your dog's grooming needs or the K9 Atelier experience? We would be happy to help."
    >
      <div className="mx-auto grid max-w-3xl gap-4">
        <section className="border border-gray-line/80 bg-ivory p-6 md:p-8">
          <h2 className="font-body text-[11px] font-medium uppercase tracking-[0.16em] text-taupe">
            Email
          </h2>
          <a
            href={`mailto:${brand.email}`}
            className="font-body mt-3 inline-block text-lg text-ink transition hover:text-deep-lavender"
          >
            {brand.email}
          </a>
        </section>

        <section className="border border-gray-line/80 bg-ivory p-6 md:p-8">
          <h2 className="font-body text-[11px] font-medium uppercase tracking-[0.16em] text-taupe">
            Instagram
          </h2>
          <a
            href={instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-body mt-3 inline-block text-lg text-ink transition hover:text-deep-lavender"
          >
            @{instagramHandle}
          </a>
        </section>

        <section className="border border-gray-line/80 bg-ivory p-6 md:p-8">
          <h2 className="font-body text-[11px] font-medium uppercase tracking-[0.16em] text-taupe">
            Service Area
          </h2>
          <p className="font-body mt-3 text-base text-ink">
            Serving Palm Beach Gardens and surrounding Palm Beach communities.
          </p>
          <p className="font-body mt-2 text-sm text-taupe">
            Complimentary standard travel within {serviceArea.freeRadiusMiles}{" "}
            miles. Extended service up to approximately{" "}
            {serviceArea.maxDistanceMiles} miles. $
            {serviceArea.travelFeePerMile} / one-way mile outside standard
            radius.
          </p>
        </section>

        <section className="border border-gray-line/80 bg-ivory p-6 md:p-8">
          <h2 className="font-body text-[11px] font-medium uppercase tracking-[0.16em] text-taupe">
            Hours
          </h2>
          <p className="font-body mt-3 text-base text-ink">
            {daysLabel} · {hoursLabel} Eastern
          </p>
          <p className="font-body mt-2 text-sm text-taupe">
            By appointment only. Weekend appointments by request.
          </p>
        </section>
      </div>

      <div className="mt-14 flex flex-col items-center justify-center gap-4 sm:flex-row">
        <BookServiceLink className="inline-flex min-h-[52px] items-center justify-center rounded-sm bg-deep-lavender px-8 text-[10px] font-medium uppercase tracking-[0.16em] text-ivory transition hover:bg-ink">
          Request an Appointment
        </BookServiceLink>
        <LuxuryButton href={`mailto:${brand.email}`} variant="secondary">
          Email the Atelier
        </LuxuryButton>
      </div>
    </PageShell>
  );
}

import Link from "next/link";
import { BookServiceLink } from "@/components/booking/BookServiceLink";
import { business } from "@/lib/business";

export const metadata = {
  title: "Contact K9 Atelier",
  description:
    "Get in touch with K9 Atelier — email, social, service area, and booking hours for luxury mobile dog grooming in Palm Beach County.",
};

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** "09:00" -> "9:00 AM", "16:00" -> "4:00 PM" */
function formatTime(value: string) {
  const [hStr, mStr] = value.split(":");
  const hour = Number(hStr);
  const minute = mStr ?? "00";
  const period = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${minute} ${period}`;
}

export default function ContactPage() {
  const { brand, booking, serviceArea } = business;

  const days = booking.availableDays;
  const daysLabel =
    days.length > 1
      ? `${capitalize(days[0])} – ${capitalize(days[days.length - 1])}`
      : capitalize(days[0] ?? "");
  const hoursLabel = `${formatTime(booking.hoursStart)} – ${formatTime(
    booking.hoursEnd,
  )}`;

  return (
    <div className="mx-auto max-w-3xl px-6 py-12 md:py-16">
      <header className="text-center">
        <p className="text-xs font-medium uppercase tracking-[0.25em] text-gold">
          We&apos;d love to hear from you.
        </p>
        <h1 className="mt-4 text-4xl font-semibold text-gold-dark">
          Contact K9 Atelier
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-text-muted">
          Questions about our services, your dog&apos;s grooming needs, or
          scheduling a mobile appointment? Reach out anytime — we&apos;re happy
          to help.
        </p>
      </header>

      <div className="mt-12 space-y-4">
        <section className="rounded-2xl border border-lavender/30 bg-cream p-6">
          <h2 className="text-sm font-medium uppercase tracking-wide text-text-muted">
            Email
          </h2>
          <a
            href={`mailto:${brand.email}`}
            className="mt-2 inline-block text-lg font-medium text-gold-dark transition hover:text-gold"
          >
            {brand.email}
          </a>
        </section>

        {brand.phone && (
          <section className="rounded-2xl border border-lavender/30 bg-cream p-6">
            <h2 className="text-sm font-medium uppercase tracking-wide text-text-muted">
              Phone
            </h2>
            <a
              href={`tel:${brand.phone}`}
              className="mt-2 inline-block text-lg font-medium text-gold-dark transition hover:text-gold"
            >
              {brand.phone}
            </a>
          </section>
        )}

        <section className="rounded-2xl border border-lavender/30 bg-cream p-6">
          <h2 className="text-sm font-medium uppercase tracking-wide text-text-muted">
            Follow Us
          </h2>
          <div className="mt-2 space-y-1 text-lg text-text">
            <p>
              <span className="font-medium text-gold-dark">Instagram:</span>{" "}
              {brand.social.instagram}
            </p>
            <p>
              <span className="font-medium text-gold-dark">Facebook:</span>{" "}
              {brand.social.facebook}
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-lavender/30 bg-cream p-6">
          <h2 className="text-sm font-medium uppercase tracking-wide text-text-muted">
            Service Area
          </h2>
          <p className="mt-2 text-lg text-text">
            {serviceArea.homeAddress.publicLabel}
          </p>
          <p className="mt-1 text-sm text-text-muted">
            Mobile grooming brought directly to your doorstep.
          </p>
        </section>

        <section className="rounded-2xl border border-lavender/30 bg-cream p-6">
          <h2 className="text-sm font-medium uppercase tracking-wide text-text-muted">
            Booking Hours
          </h2>
          <p className="mt-2 text-lg text-text">
            {daysLabel}
            <span className="text-text-muted"> · {hoursLabel} (Eastern Time)</span>
          </p>
          <p className="mt-1 text-sm text-text-muted">
            By appointment only. Weekends reserved on request.
          </p>
        </section>
      </div>

      <div className="mt-14 flex flex-col items-center justify-center gap-4 sm:flex-row">
        <BookServiceLink className="inline-block rounded-full bg-gold px-8 py-3 text-sm font-medium text-white transition hover:bg-gold-dark">
          Book an Appointment
        </BookServiceLink>
        <Link
          href="/services"
          className="inline-block rounded-full border border-gold px-8 py-3 text-sm font-medium text-gold-dark transition hover:bg-gold hover:text-white"
        >
          View Services
        </Link>
      </div>
    </div>
  );
}

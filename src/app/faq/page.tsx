import Link from "next/link";
import { BookServiceLink } from "@/components/booking/BookServiceLink";
import { business } from "@/lib/business";

export const metadata = {
  title: "FAQ · K9 Atelier",
  description:
    "Frequently asked questions about K9 Atelier mobile dog grooming — service area, hours, payment, cancellations, large dogs, spa treatments, and how to prepare.",
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

export default function FaqPage() {
  const { booking, serviceArea, weightPolicy } = business;

  const days = booking.availableDays;
  const daysLabel =
    days.length > 1
      ? `${capitalize(days[0])} – ${capitalize(days[days.length - 1])}`
      : capitalize(days[0] ?? "");
  const hoursLabel = `${formatTime(booking.hoursStart)} – ${formatTime(
    booking.hoursEnd,
  )}`;

  const cancellationPolicy = booking.cancellationPolicy;

  const cancellationAnswer = (
    <div className="space-y-5">
      <p className="text-base leading-relaxed text-text-muted">
        {cancellationPolicy.intro}
      </p>
      {cancellationPolicy.sections.map((section) => {
        const table = "table" in section ? section.table : undefined;
        return (
          <div key={section.heading}>
            <h3 className="text-base font-semibold text-gold-dark">
              {section.heading}
            </h3>
            <p className="mt-1 text-base leading-relaxed text-text-muted">
              {section.body}
            </p>
            {table && (
              <div className="mt-3 overflow-hidden rounded-xl border border-lavender/30">
                <table className="w-full text-left text-sm">
                  <thead className="bg-lavender-light/60">
                    <tr>
                      {table.columns.map((col) => (
                        <th key={col} className="px-4 py-2 font-medium text-text">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {table.rows.map((row) => (
                      <tr
                        key={row.join("|")}
                        className="border-t border-lavender/20"
                      >
                        {row.map((cell, cellIndex) => (
                          <td
                            key={cellIndex}
                            className="px-4 py-2 text-text-muted"
                          >
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
      <p className="text-base leading-relaxed text-text-muted">
        {cancellationPolicy.outro}
      </p>
    </div>
  );

  const faqs: Array<{ q: string; a: React.ReactNode }> = [
    {
      q: "How does mobile grooming work?",
      a: `We bring a fully equipped, self-contained grooming studio directly to your home. Your dog is groomed one-on-one in a calm, cage-free environment — no drop-off, no waiting room, and no long day away from home.`,
    },
    {
      q: "What area do you serve? Is there a travel fee?",
      a: `We serve the ${serviceArea.homeAddress.publicLabel}. Travel is complimentary within ${serviceArea.freeRadiusMiles} miles of our base. Beyond that, a travel fee of $${serviceArea.travelFeePerMile} per one-way mile applies (based on GPS driving distance), and we currently serve addresses up to ${serviceArea.maxDistanceMiles} miles away.`,
    },
    {
      q: "What are your hours, and how do I book?",
      a: `Appointments are available ${daysLabel}, ${hoursLabel} (Eastern Time), by appointment only. You can request a booking online, and we'll confirm your date and time.`,
    },
    {
      q: "Do you groom large dogs?",
      a: `${weightPolicy.over45Note} For dogs within our standard weight range (up to ${weightPolicy.maxStandardWeightLbs} lbs), all bath, grooming, and spa services are available.`,
    },
    {
      q: "Can I book a spa treatment and a full haircut on the same day?",
      a: `We recommend booking spa treatments separately from a full haircut or styling appointment. Spa services include a full wellness bath and a whole-body massage, so keeping them on their own day helps avoid over-tiring your dog and keeps the experience relaxing.`,
    },
    {
      q: "How does payment work? Will I be charged when I book?",
      a: `${booking.paymentMethodNote} New clients place a $${booking.newClientDeposit} deposit to confirm their first appointment, which is applied toward your service total. Your remaining balance is settled after the appointment.`,
    },
    {
      q: "What is your cancellation or rescheduling policy?",
      a: cancellationAnswer,
    },
    {
      q: "How should I prepare for my appointment?",
      a: `Give your dog a chance to potty beforehand, and let us know in advance about any health conditions, skin sensitivities, allergies, or anxiety. Every appointment begins with a gentle health and skin check; if fleas or ticks are found, a medicated bath and vehicle sanitation fee applies. For heavily matted coats, we prioritize comfort and safety and may recommend a gentle shave-down rather than painful dematting.`,
    },
    {
      q: "Are your grooming and color products safe?",
      a: `Yes. We use premium, coat-appropriate products, and all creative coloring uses 100% non-toxic, pet-safe, semi-permanent color made for animal coats. Creative coloring requires an advance consultation and must be booked together with a Signature Bath & Care or Custom Full Haircut & Styling.`,
    },
  ];

  return (
    <div className="mx-auto max-w-3xl px-6 py-12 md:py-16">
      <header className="text-center">
        <p className="text-xs font-medium uppercase tracking-[0.25em] text-gold">
          Answers, before you ask.
        </p>
        <h1 className="mt-4 text-4xl font-semibold text-gold-dark">
          Frequently Asked Questions
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-text-muted">
          Everything you need to know about booking a calm, cage-free mobile
          grooming experience for your dog.
        </p>
      </header>

      <div className="mt-12 space-y-4">
        {faqs.map((faq) => (
          <details
            key={faq.q}
            className="group rounded-2xl border border-lavender/30 bg-cream p-6 [&_svg]:open:rotate-45"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-medium text-gold-dark">
              {faq.q}
              <svg
                className="h-5 w-5 shrink-0 text-gold transition-transform"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M10 4v12M4 10h12" />
              </svg>
            </summary>
            <div className="mt-4 text-base leading-relaxed text-text-muted">
              {faq.a}
            </div>
          </details>
        ))}
      </div>

      <div className="mt-14 flex flex-col items-center justify-center gap-4 sm:flex-row">
        <BookServiceLink className="inline-block rounded-full bg-gold px-8 py-3 text-sm font-medium text-white transition hover:bg-gold-dark">
          Book an Appointment
        </BookServiceLink>
        <Link
          href="/contact"
          className="inline-block rounded-full border border-gold px-8 py-3 text-sm font-medium text-gold-dark transition hover:bg-gold hover:text-white"
        >
          Still have questions? Contact us
        </Link>
      </div>
    </div>
  );
}

import { BookServiceLink } from "@/components/booking/BookServiceLink";
import { LuxuryButton } from "@/components/luxury/LuxuryButton";
import { PageShell } from "@/components/luxury/PageShell";
import { business, getPaymentFaqParagraphs, getServiceAreaFaqParagraphs } from "@/lib/business";

export const metadata = {
  title: "FAQ · K9 Atelier",
  description:
    "Frequently asked questions about K9 Atelier, a Private Mobile Pet Spa — appointments, service area, payment, cancellations, and care policies.",
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

const faqGroups = [
  {
    title: "Your Appointment",
    ids: [0, 1, 2, 7],
  },
  {
    title: "Service & Care",
    ids: [3, 4, 8],
  },
  {
    title: "Policies",
    ids: [5, 6],
  },
] as const;

export default function FaqPage() {
  const { booking, weightPolicy } = business;

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
      <p>{cancellationPolicy.intro}</p>
      {cancellationPolicy.sections.map((section) => {
        const table = "table" in section ? section.table : undefined;
        return (
          <div key={section.heading}>
            <h3 className="font-body text-sm font-semibold uppercase tracking-[0.12em] text-ink">
              {section.heading}
            </h3>
            <p className="mt-2">{section.body}</p>
            {table && (
              <div className="mt-3 overflow-hidden border border-gray-line/80">
                <table className="w-full text-left text-sm">
                  <thead className="bg-dusty-lavender/35">
                    <tr>
                      {table.columns.map((col) => (
                        <th
                          key={col}
                          className="px-4 py-3 font-body text-[11px] font-medium uppercase tracking-[0.12em] text-taupe"
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {table.rows.map((row) => (
                      <tr
                        key={row.join("|")}
                        className="border-t border-gray-line/60"
                      >
                        {row.map((cell, cellIndex) => (
                          <td key={cellIndex} className="px-4 py-3 text-taupe">
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
      <p>{cancellationPolicy.outro}</p>
    </div>
  );

  const faqs: Array<{ q: string; a: React.ReactNode }> = [
    {
      q: "How does mobile grooming work?",
      a: "We bring a fully equipped, self-contained grooming salon directly to your home. Your dog is groomed one-on-one in a calm, cage-free environment — no drop-off, no waiting room and no long day away from home.",
    },
    {
      q: "What area do you serve? Is there a travel fee?",
      a: (
        <div className="space-y-4">
          {getServiceAreaFaqParagraphs().map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      ),
    },
    {
      q: "What are your hours, and how do I book?",
      a: `Appointments are available ${daysLabel}, ${hoursLabel} Eastern, by appointment only. Weekend appointments may be available by request.`,
    },
    {
      q: "Do you groom dogs over 45 lbs?",
      a: `Standard bathing, grooming and Spa services are designed for dogs up to ${weightPolicy.maxStandardWeightLbs} lbs. ${weightPolicy.over45Note}`,
    },
    {
      q: "Can I combine a Spa Ritual and Full Groom?",
      a: "For your dog's comfort, Spa treatments are best scheduled separately from a full haircut/styling appointment.",
    },
    {
      q: "How does payment work?",
      a: (
        <div className="space-y-4">
          {getPaymentFaqParagraphs().map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      ),
    },
    {
      q: "What is your cancellation policy?",
      a: cancellationAnswer,
    },
    {
      q: "How should I prepare for my appointment?",
      a: "Give your dog an opportunity to potty before the appointment and share relevant health, coat, skin, allergy or anxiety information in advance.",
    },
    {
      q: "Are grooming and color products pet-safe?",
      a: "We use premium coat-appropriate products. Creative color products must be non-toxic and specifically intended for animal coats.",
    },
  ];

  return (
    <PageShell
      eyebrow="FAQ"
      title="Questions About Your Appointment"
      intro="Everything you need to know about booking a calm, private, cage-free mobile grooming experience."
    >
      <div className="mx-auto max-w-3xl space-y-14">
        {faqGroups.map((group) => (
          <section key={group.title}>
            <h2 className="font-body text-[11px] font-semibold uppercase tracking-[0.18em] text-deep-lavender">
              {group.title}
            </h2>
            <div className="mt-6 divide-y divide-gray-line/80 border-y border-gray-line/80">
              {group.ids.map((index) => {
                const faq = faqs[index];
                if (!faq) return null;
                return (
                  <details key={faq.q} className="group py-6">
                    <summary className="cursor-pointer list-none font-body text-base font-medium text-ink marker:content-none [&::-webkit-details-marker]:hidden">
                      <span className="flex items-start justify-between gap-4">
                        {faq.q}
                        <span className="text-champagne transition group-open:rotate-45">
                          +
                        </span>
                      </span>
                    </summary>
                    <div className="font-body mt-4 text-sm leading-relaxed text-taupe">
                      {faq.a}
                    </div>
                  </details>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <div className="mt-14 flex flex-col items-center justify-center gap-4 sm:flex-row">
        <BookServiceLink className="inline-flex min-h-[52px] items-center justify-center rounded-sm bg-deep-lavender px-8 text-[10px] font-medium uppercase tracking-[0.16em] text-ivory transition hover:bg-ink">
          Request an Appointment
        </BookServiceLink>
        <LuxuryButton href="/contact" variant="secondary">
          Email the Atelier
        </LuxuryButton>
      </div>
    </PageShell>
  );
}

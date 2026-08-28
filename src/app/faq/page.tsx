import { BookServiceLink } from "@/components/booking/BookServiceLink";
import { LuxuryButton } from "@/components/luxury/LuxuryButton";
import { PageShell } from "@/components/luxury/PageShell";

export const metadata = {
  title: "FAQ · K9 Atelier",
  description:
    "Frequently asked questions about K9 Atelier, a Private Mobile Pet Spa — appointments, service area, payment, cancellations, and care policies.",
};

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

const cancellationPolicy = {
  intro:
    "Each appointment is reserved exclusively for your dog and includes dedicated travel, preparation, and service time. To help us provide every client with attentive, unrushed care, the following cancellation and rescheduling policy applies.",
  sections: [
    {
      heading: "1. Cancellations & Rescheduling",
      body: "We kindly request at least 48 hours’ notice when canceling or rescheduling an appointment. This allows us an opportunity to offer the reserved time to another client.",
      table: {
        columns: ["Notice Given", "Policy"],
        rows: [
          ["48 hours or more before the appointment", "No fee"],
          [
            "Between 24 and 48 hours before the appointment",
            "50% of the scheduled service price",
          ],
          [
            "Less than 24 hours, including same-day cancellation or rescheduling",
            "100% of the scheduled service price",
          ],
        ],
      },
    },
    {
      heading: "2. No-Shows",
      body: "If we arrive for your scheduled appointment and cannot reach you, access the property, or receive your dog within 15 minutes of the scheduled time, the appointment will be considered a no-show.\n\nThe full scheduled service price and any applicable travel fee will be charged to the payment method on file.",
    },
    {
      heading: "3. Delayed Access at Appointment Time",
      body: "Please ensure that you, your dog, and the reserved parking space are available at the scheduled appointment time.\n\nIf access is delayed by more than 15 minutes, we may need to shorten or reschedule the service to avoid affecting the next client. Applicable cancellation or rescheduling fees may apply.",
    },
    {
      heading: "4. Illness or Emergencies",
      body: "We understand that unexpected health concerns involving you or your dog may arise. Please contact us as soon as possible.\n\nGenuine emergencies will be reviewed with compassion on a case-by-case basis and may be exempt from standard cancellation fees.",
    },
    {
      heading: "5. Payment Method on File",
      body: "A valid payment method must remain on file and may be charged for applicable cancellation, rescheduling, or no-show fees.",
    },
    {
      heading: "6. When a Service Cannot Be Completed",
      body: "Your dog’s comfort and safety always come first. If we determine that a service cannot be safely completed because of stress, health concerns, severe matting, behavioral challenges, or an unexpected condition discovered during the appointment, we will pause the service and discuss the available options with you.\n\nCharges will reflect the time reserved, work performed, products used, and any necessary additional care. A minimum charge of 50% of the scheduled service price may apply, together with any previously disclosed travel fee. We will explain all applicable charges before proceeding whenever circumstances allow.\n\nAny remaining service may require a separate appointment. If we cannot begin or complete the service because of an issue on our side, you will not be charged, and the appointment will be rescheduled without penalty.",
    },
  ],
  outro:
    "Thank you for understanding. These policies allow us to protect the dedicated time and individualized care every dog on our schedule deserves—including yours.",
};

function FaqParagraphs({ paragraphs }: { paragraphs: string[] }) {
  return (
    <div className="space-y-4">
      {paragraphs.map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}
    </div>
  );
}

export default function FaqPage() {
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
            {section.body.split("\n\n").map((paragraph) => (
              <p key={paragraph} className="mt-2">
                {paragraph}
              </p>
            ))}
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
      a: "K9 Atelier brings a fully equipped, self-contained private grooming studio directly to your home. Your dog receives uninterrupted, one-on-one care in a calm, cage-free environment—with no car ride, waiting room, or extended stay away from home.",
    },
    {
      q: "What areas do you serve, and is there a travel fee?",
      a: (
        <FaqParagraphs
          paragraphs={[
            "K9 Atelier serves West Palm Beach, Palm Beach, Palm Beach Gardens, Jupiter, Jupiter Island, and Tequesta.",
            "Travel is complimentary within 10 driving miles of our base location. For appointments beyond the complimentary service area, a travel fee of $6.50 applies to each one-way driving mile exceeding the 10-mile radius, calculated using GPS driving distance.",
            "For example, if your location is 15 driving miles from our base, the travel fee is calculated on the 5 miles beyond the complimentary service area.",
            "Appointments beyond 20 miles may be considered individually. Please contact us before booking to confirm availability and travel pricing.",
          ]}
        />
      ),
    },
    {
      q: "What are your hours, and how do I book?",
      a: (
        <FaqParagraphs
          paragraphs={[
            "Appointments are available Monday through Friday, from 9:00 AM to 4:00 PM Eastern Time. Limited weekend availability may be offered by request.",
            "To begin, create your pet’s profile, select your preferred date and time from our appointment calendar, and upload your pet’s vaccination records. Once we have reviewed the submitted information, we will send you an email confirming your appointment.",
            "Please note that selecting a date and time does not guarantee an appointment until you receive our confirmation email.",
          ]}
        />
      ),
    },
    {
      q: "Do you groom dogs over 45 lbs?",
      a: (
        <FaqParagraphs
          paragraphs={[
            "Our Standard Bathing, Grooming, and Spa Services are designed for dogs weighing up to 45 lbs.",
            "For dogs over 45 lbs, availability is limited to select services, including Hand Stripping without a bath and End-of-Life Comfort Care. Please contact us before booking so we can determine whether we can safely accommodate your dog’s individual needs.",
          ]}
        />
      ),
    },
    {
      q: "Can I combine a Spa Ritual with a Full Groom?",
      a: (
        <FaqParagraphs
          paragraphs={[
            "To protect your dog’s comfort and prevent an overly long appointment, Spa Rituals are generally scheduled separately from a Full Groom.",
            "If you are interested in both services, we will be happy to recommend the most comfortable treatment plan and schedule for your dog.",
          ]}
        />
      ),
    },
    {
      q: "How does payment work?",
      a: (
        <FaqParagraphs
          paragraphs={[
            "A valid payment method is required to reserve an appointment. When booking, you will add or select the card you would like associated with that visit.",
            "Your card is not charged at the time of booking. Payment is processed after the appointment is completed. Applicable cancellation, rescheduling, or no-show fees may be charged to the selected card in accordance with our policy.",
          ]}
        />
      ),
    },
    {
      q: "What is your cancellation and rescheduling policy?",
      a: cancellationAnswer,
    },
    {
      q: "How should I prepare for my appointment?",
      a: (
        <FaqParagraphs
          paragraphs={[
            "Please give your dog an opportunity to relieve themselves before the appointment. Before we arrive, kindly share any relevant information regarding your dog’s health, skin and coat condition, allergies, sensitivities, or anxiety.",
            "We also ask that you reserve a safe, accessible parking space for our mobile spa van. Please ensure that gates are unlocked and any community, security, or property access arrangements have been made before our arrival.",
          ]}
        />
      ),
    },
    {
      q: "Are your grooming and creative color products pet-safe?",
      a: (
        <FaqParagraphs
          paragraphs={[
            "Yes. We use premium, professional products selected according to each dog’s coat, skin condition, and individual sensitivities.",
            "All Creative Color products are non-toxic and specifically formulated for use on animals. Please let us know in advance if your dog has any known allergies, sensitivities, or previous reactions to grooming products.",
          ]}
        />
      ),
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

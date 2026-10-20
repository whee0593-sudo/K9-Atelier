import { BookServiceLink } from "@/components/booking/BookServiceLink";
import { LuxuryButton } from "@/components/luxury/LuxuryButton";
import { PageShell } from "@/components/luxury/PageShell";
import { FeesPoliciesSection } from "@/components/services/FeesPoliciesSection";
import Link from "next/link";

export const metadata = {
  title: "FAQ · K9 Atelier",
  description:
    "Frequently asked questions about K9 Atelier, a Private Mobile Pet Spa — appointments, service area, payment, cancellations, and care policies.",
};

const cancellationPolicy = {
  intro:
    "Each appointment is reserved exclusively for your dog and includes dedicated travel, preparation, and grooming time. We kindly ask for at least 48 hours' notice for cancellations or rescheduling.",
  sections: [
    {
      heading: "1. Cancellations & Rescheduling",
      body: "We kindly request at least 48 hours’ notice when canceling or rescheduling an appointment. This allows us an opportunity to offer the reserved time to another client.\n\nThe percentage applies to the scheduled service price plus any travel fee on that visit.",
      table: {
        columns: ["Notice", "Fee"],
        rows: [
          ["48 hours or more", "No fee"],
          ["Less than 48 hours, but not the same day", "50%"],
          ["Same-day cancellation or rescheduling", "100%"],
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

type FaqItem = {
  q: string;
  paragraphs?: readonly string[];
  custom?: "cancellation" | "referral";
};

const faqGroups: Array<{ title: string; items: FaqItem[] }> = [
  {
    title: "The Visit",
    items: [
      {
        q: "How does mobile grooming work?",
        paragraphs: [
          "We groom your dog one-on-one in our mobile spa, parked outside your home.",
        ],
      },
      {
        q: "Do you groom dogs inside my home?",
        paragraphs: [
          "No. Grooming takes place inside the mobile spa.",
        ],
      },
      {
        q: "Will my dog be kept in a cage or crate?",
        paragraphs: [
          "No. Every visit is cage-free.",
        ],
      },
      {
        q: "Will my dog be around other dogs?",
        paragraphs: [
          "No. Dogs from the same household can be groomed one at a time.",
        ],
      },
      {
        q: "Do I need to provide water or electricity?",
        paragraphs: [
          "No. The mobile spa has its own water and power.",
        ],
      },
      {
        q: "Where should the grooming van park?",
        paragraphs: [
          "Please provide a safe, level parking space near your home, preferably a driveway. Tell us about parking fees, restrictions or community access requirements.",
        ],
      },
      {
        q: "Do I need to be home during the appointment?",
        paragraphs: [
          "No, but you or someone you trust must be available to hand over and receive your dog.",
        ],
      },
      {
        q: "How should I prepare for my appointment?",
        paragraphs: [
          "Give your dog a bathroom break before we arrive, and tell us about health concerns, allergies or handling needs.",
        ],
      },
    ],
  },
  {
    title: "Booking",
    items: [
      {
        q: "What areas do you serve, and is there a travel fee?",
        paragraphs: [
          "We proudly serve Jupiter Island, Jupiter, Tequesta, Palm Beach Gardens, Palm Beach, and West Palm Beach. Travel is complimentary within 10 driving miles of our service base. Additional travel fees may apply beyond that distance and will be displayed before you submit your booking request.",
        ],
      },
      {
        q: "What are your hours, and how do I book?",
        paragraphs: [
          "Monday through Friday, from 9 AM to 5 PM. Choose Book Online, add your dog's details, select a service and time, then complete your details and save a card. No charge today.",
        ],
      },
      {
        q: "How long does a grooming appointment take?",
        paragraphs: [
          "Most full grooming appointments take approximately 75–120 minutes, depending on your dog's size, coat condition, and individual needs. Other services may take more or less time. We always work at your dog's pace.",
        ],
      },
      {
        q: "Is my appointment time exact?",
        paragraphs: [
          "We do our best to arrive within your scheduled arrival window. Because we're a mobile service, traffic, weather, and previous appointments may occasionally affect our arrival. We'll send you a text when we're on the way.",
        ],
      },
    ],
  },
  {
    title: "Your Dog",
    items: [
      {
        q: "Do you groom dogs over 45 lbs?",
        paragraphs: [
          "Our standard grooming and spa services are designed for dogs weighing up to 45 lbs. Select specialty services, including hand stripping without a bath and End-of-Life Comfort Care, may be available for larger dogs. Please contact us before booking.",
        ],
      },
      {
        q: "Do you groom puppies or senior dogs?",
        paragraphs: [
          "Yes. We adjust handling and pace to your dog's age and comfort.",
        ],
      },
      {
        q: "What if my dog is nervous or has special needs?",
        paragraphs: [
          "Tell us about anxiety, health concerns or handling needs before booking. Extra handling fees may apply.",
        ],
      },
      {
        q: "What vaccinations are required?",
        paragraphs: [
          "Dogs four months or older must have a current rabies vaccination as required by Florida law, unless a veterinarian-issued medical exemption applies. Vaccination details and document uploads are optional during booking and can be provided later.",
        ],
      },
      {
        q: "Can I combine Luxury Spa Day with a Full Groom?",
        paragraphs: [
          "These are generally booked separately to avoid an overly long session.",
        ],
      },
      {
        q: "Are your grooming and creative color products pet-safe?",
        paragraphs: [
          "Yes. We use professional grooming products selected with your dog's skin, coat, and sensitivities in mind. Our Creative Color products are non-toxic and formulated specifically for animals. Please tell us about any known allergies or sensitivities.",
        ],
      },
    ],
  },
  {
    title: "Payment",
    items: [
      {
        q: "Why do I need to save a credit card?",
        paragraphs: [
          "A valid card is required to secure your appointment, but you won't be charged when booking. You're welcome to pay with cash or Zelle after grooming. Applicable cancellation, rescheduling, or no-show fees may be charged to your saved card.",
        ],
      },
      {
        q: "Can I pay with cash or Zelle?",
        paragraphs: [
          "Yes. We gladly accept cash and Zelle after grooming, as well as credit cards.",
        ],
      },
    ],
  },
  {
    title: "Policies",
    items: [
      {
        q: "What is your cancellation and rescheduling policy?",
        custom: "cancellation",
      },
    ],
  },
  {
    title: "Our Work",
    items: [
      {
        q: "Are all the photos on this website your real work?",
        paragraphs: [
          "Yes. Every dog featured on our website was personally groomed and styled by Penny. Some images may have been digitally edited to remove distracting backgrounds or create a consistent presentation.",
        ],
      },
    ],
  },
  {
    title: "Referral Rewards",
    items: [
      {
        q: "How do Referral Rewards work?",
        custom: "referral",
      },
    ],
  },
];

function FaqParagraphs({ paragraphs }: { paragraphs: readonly string[] }) {
  return (
    <div className="space-y-4">
      {paragraphs.map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}
    </div>
  );
}

function CancellationAnswer() {
  return (
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
              <div className="mt-3 overflow-x-auto border border-gray-line/80">
                <table className="w-full min-w-[18rem] text-left text-sm">
                  <thead className="bg-dusty-lavender/35">
                    <tr>
                      {table.columns.map((col) => (
                        <th
                          key={col}
                          className="px-4 py-3 font-body text-sm font-medium uppercase tracking-[0.12em] text-ink"
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
                          <td key={cellIndex} className="px-4 py-3 text-ink">
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
}

function ReferralAnswer() {
  return (
    <div className="space-y-4">
      <p>
        Every dog receives a unique referral code. When a new household uses
        your code, they receive 10% off eligible service charges on their first
        completed appointment. Once that visit is completed and paid, you
        receive promotional Referral Credit equal to their savings.
      </p>
      <p>
        Referral Credit can be applied, in full or in part, toward eligible
        service charges on a future appointment. Referral credits do not apply
        to travel fees, special handling fees, or gratuities.         Referral Credit has no cash value and cannot be transferred, withdrawn, sold, or exchanged for cash.
      </p>
      <p>
        Full program rules are available on the{" "}
        <Link
          href="/referrals"
          className="underline decoration-champagne/70 underline-offset-4 transition hover:text-ink"
        >
          Referral Rewards
        </Link>{" "}
        page.
      </p>
    </div>
  );
}

function FaqAnswer({ item }: { item: FaqItem }) {
  if (item.custom === "cancellation") return <CancellationAnswer />;
  if (item.custom === "referral") return <ReferralAnswer />;
  return <FaqParagraphs paragraphs={item.paragraphs ?? []} />;
}

export default function FaqPage() {
  return (
    <PageShell
      eyebrow="FAQ"
      title="Questions About Your Appointment"
    >
      <div className="mx-auto max-w-3xl space-y-14">
        {faqGroups.map((group) => (
          <section key={group.title}>
            <h2 className="font-body text-sm font-semibold uppercase tracking-[0.18em] text-deep-lavender">
              {group.title}
            </h2>
            <div className="mt-6 divide-y divide-gray-line/80 border-y border-gray-line/80">
              {group.items.map((faq) => (
                <details key={faq.q} className="group py-2">
                  <summary className="cursor-pointer list-none py-4 font-body text-base font-medium text-ink marker:content-none [&::-webkit-details-marker]:hidden">
                    <span className="flex min-h-11 items-start justify-between gap-4">
                      <span className="min-w-0 flex-1 text-left">{faq.q}</span>
                      <span className="text-champagne transition group-open:rotate-45">
                        +
                      </span>
                    </span>
                  </summary>
                  <div className="font-body pb-4 text-base leading-relaxed text-ink">
                    <FaqAnswer item={faq} />
                  </div>
                </details>
              ))}
            </div>
          </section>
        ))}
      </div>

      <section id="fees-policies" className="mx-auto mt-16 max-w-3xl scroll-mt-32">
        <h2 className="font-body text-sm font-semibold uppercase tracking-[0.18em] text-deep-lavender">
          Fees &amp; Policies
        </h2>
        <div className="mt-8">
          <FeesPoliciesSection />
        </div>
      </section>

      <div className="mt-14 flex flex-col items-center justify-center gap-4 sm:flex-row">
        <BookServiceLink className="inline-flex min-h-[52px] items-center justify-center rounded-sm bg-deep-lavender px-8 text-sm font-medium uppercase tracking-[0.16em] text-ivory transition hover:bg-ink">
          Book Online
        </BookServiceLink>
        <LuxuryButton href="/contact" variant="secondary">
          Email the Atelier
        </LuxuryButton>
      </div>
    </PageShell>
  );
}

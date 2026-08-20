import Link from "next/link";
import { PageShell } from "@/components/luxury/PageShell";
import { business } from "@/lib/business";

export const metadata = {
  title: "Terms & Conditions · K9 Atelier",
  description:
    "Website and SMS program terms for K9 Atelier mobile pet grooming appointments.",
};

const lastUpdated = "August 20, 2026";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-gray-line/80 bg-ivory p-6 md:p-8">
      <h2 className="font-body text-[11px] font-medium uppercase tracking-[0.16em] text-taupe">
        {title}
      </h2>
      <div className="font-body mt-4 space-y-3 text-base leading-relaxed text-ink">
        {children}
      </div>
    </section>
  );
}

export default function TermsPage() {
  const { brand } = business;

  return (
    <PageShell
      eyebrow="Legal"
      title="Terms & Conditions"
      intro={`Last updated ${lastUpdated}. These terms cover use of k9atelier.com and the K9 Atelier appointment text-message program.`}
    >
      <div className="mx-auto grid max-w-3xl gap-4">
        <Section title="The atelier">
          <p>
            K9 Atelier provides private, mobile pet grooming by appointment in
            the Palm Beach, Florida area. Booking, payment, cancellation, and
            service policies published on this website apply to appointments.
          </p>
        </Section>

        <Section title="SMS program">
          <p>
            By checking the SMS consent box and providing your mobile number at{" "}
            <a
              href="https://k9atelier.com/book"
              className="underline decoration-champagne underline-offset-4 hover:text-deep-lavender"
            >
              k9atelier.com/book
            </a>
            , you agree to receive recurring, appointment-related text messages
            from K9 Atelier at the number you provide. Messages may include
            appointment request received, confirmation, decline, same-day
            reminders, and on-the-way arrival notices.
          </p>
          <p>
            <strong>Message frequency varies</strong> and is tied to a booked
            appointment. You can typically expect a few messages per visit.
          </p>
          <p>
            <strong>Message and data rates may apply.</strong> Carriers are not
            liable for delayed or undelivered messages.
          </p>
          <p>
            Consent is not sold or shared for third-party marketing. See our{" "}
            <Link
              href="/privacy"
              className="underline decoration-champagne underline-offset-4 hover:text-deep-lavender"
            >
              Privacy Policy
            </Link>{" "}
            for how mobile numbers are used.
          </p>
        </Section>

        <Section title="Opt out and help">
          <p>
            Reply <strong>STOP</strong> to cancel SMS at any time. After you
            opt out, we will send a confirmation and will not text that number
            unless you opt in again. Reply <strong>HELP</strong> for help, or
            email{" "}
            <a
              href={`mailto:${brand.email}`}
              className="underline decoration-champagne underline-offset-4 hover:text-deep-lavender"
            >
              {brand.email}
            </a>
            {brand.phone ? ` or call ${brand.phone}` : ""}.
          </p>
        </Section>

        <Section title="Website">
          <p>
            Content on this site is for information about K9 Atelier services.
            Prices shown are estimates and may change based on your dog&apos;s
            condition on the day of service, as disclosed at booking. You are
            responsible for providing accurate account, pet, and address
            information.
          </p>
        </Section>

        <Section title="Appointments and payment">
          <p>
            A valid payment method must be on file before a pet profile can be
            saved. You are not charged when you book. Payment is settled after
            your appointment. Late cancellations and no-shows may be charged
            according to the cancellation policy on our{" "}
            <Link
              href="/faq"
              className="underline decoration-champagne underline-offset-4 hover:text-deep-lavender"
            >
              FAQ
            </Link>
            .
          </p>
        </Section>

        <Section title="Contact">
          <p>
            {brand.name} · {brand.email}
            {brand.phone ? ` · ${brand.phone}` : ""} ·{" "}
            <a
              href="https://k9atelier.com"
              className="underline decoration-champagne underline-offset-4 hover:text-deep-lavender"
            >
              k9atelier.com
            </a>
          </p>
        </Section>
      </div>
    </PageShell>
  );
}

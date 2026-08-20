import Link from "next/link";
import { PageShell } from "@/components/luxury/PageShell";
import { business } from "@/lib/business";

export const metadata = {
  title: "Privacy Policy · K9 Atelier",
  description:
    "How K9 Atelier collects, uses, and protects personal information, including mobile numbers used for appointment texts.",
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

export default function PrivacyPage() {
  const { brand } = business;

  return (
    <PageShell
      eyebrow="Legal"
      title="Privacy Policy"
      intro={`Last updated ${lastUpdated}. This policy explains how K9 Atelier handles information you share with us, including mobile numbers used for appointment messages.`}
    >
      <div className="mx-auto grid max-w-3xl gap-4">
        <Section title="Who we are">
          <p>
            K9 Atelier is a private mobile pet grooming studio serving the Palm
            Beach, Florida area. Website:{" "}
            <a
              href="https://k9atelier.com"
              className="underline decoration-champagne underline-offset-4 hover:text-deep-lavender"
            >
              k9atelier.com
            </a>
            .
          </p>
        </Section>

        <Section title="Information we collect">
          <p>
            When you create an account or book an appointment, we may collect
            your name, email address, mobile number, service address, pet
            details, vaccination records, payment method information processed
            by our payment provider, and messages you send to us.
          </p>
        </Section>

        <Section title="How we use information">
          <p>
            We use this information to provide grooming appointments, confirm
            and remind you of visits, communicate about your dog&apos;s care,
            process payment after service, and respond to questions.
          </p>
        </Section>

        <Section title="SMS / mobile numbers">
          <p>
            If you opt in on our booking form, we send appointment-related text
            messages from K9 Atelier. These may include request received,
            confirmation, same-day reminders, and on-the-way notices.
          </p>
          <p>
            <strong>Message frequency:</strong> message frequency varies and is
            tied to a booked appointment. You can typically expect a few
            messages per visit.
          </p>
          <p>
            <strong>Message and data rates may apply.</strong> Your wireless
            carrier may charge for texts according to your plan.
          </p>
          <p>
            <strong>Non-sharing of mobile numbers:</strong> we do not sell,
            rent, or share mobile phone numbers with third parties for their
            own marketing or promotional use. We share numbers only with
            service providers (such as Twilio) as needed to deliver the
            messages you opted in to receive.
          </p>
          <p>
            Reply <strong>STOP</strong> to opt out of texts at any time. Reply{" "}
            <strong>HELP</strong> for help. You may also email{" "}
            <a
              href={`mailto:${brand.email}`}
              className="underline decoration-champagne underline-offset-4 hover:text-deep-lavender"
            >
              {brand.email}
            </a>
            .
          </p>
        </Section>

        <Section title="Service providers">
          <p>
            We use trusted vendors to operate the website, send email and SMS,
            store booking records, and process payments. They may access
            personal information only to perform those services for us.
          </p>
        </Section>

        <Section title="Your choices">
          <p>
            You may update account information after signing in, opt out of SMS
            by replying STOP, or email us to request access or deletion of
            information we hold, subject to records we must keep for
            appointments, payment, or legal reasons.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Questions about this policy: {brand.name}, {brand.email}
            {brand.phone ? `, ${brand.phone}` : ""}. SMS program terms are in
            our{" "}
            <Link
              href="/terms"
              className="underline decoration-champagne underline-offset-4 hover:text-deep-lavender"
            >
              Terms &amp; Conditions
            </Link>
            .
          </p>
        </Section>
      </div>
    </PageShell>
  );
}

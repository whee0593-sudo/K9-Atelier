import { BookServiceLink } from "@/components/booking/BookServiceLink";
import { LuxuryButton } from "@/components/luxury/LuxuryButton";
import { PageShell } from "@/components/luxury/PageShell";
import { SupportContactForm } from "@/components/support/SupportContactForm";
import { business, getBrandPhoneTelHref, getGoogleProfileUrl, getGoogleWriteReviewUrl } from "@/lib/business";

export const metadata = {
  title: "Contact · K9 Atelier",
  description:
    "Contact K9 Atelier, a Private Mobile Pet Spa in Palm Beach — email, Instagram, service area and booking hours.",
};

export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<{ topic?: string }>;
}) {
  const { topic } = await searchParams;
  if (topic === "concern") {
    return (
      <PageShell
        eyebrow="Private Message"
        title="Report a Concern"
        intro="Share what happened and we will follow up with you privately."
      >
        <div className="mx-auto max-w-xl">
          <SupportContactForm variant="concern" />
        </div>
      </PageShell>
    );
  }

  const { brand, serviceArea, site } = business;
  const phoneHref = getBrandPhoneTelHref();
  const instagramUrl =
    site.underConstruction?.instagramUrl ?? "https://instagram.com/k9atelierfl";
  const instagramHandle =
    site.underConstruction?.instagramHandle ?? "k9AtelierFL";

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

        {brand.phone && phoneHref ? (
          <section className="border border-gray-line/80 bg-ivory p-6 md:p-8">
            <h2 className="font-body text-[11px] font-medium uppercase tracking-[0.16em] text-taupe">
              Phone
            </h2>
            <a
              href={phoneHref}
              className="font-body mt-3 inline-block text-lg text-ink transition hover:text-deep-lavender"
            >
              {brand.phone}
            </a>
          </section>
        ) : null}

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

        {getGoogleProfileUrl() ? (
          <section className="border border-gray-line/80 bg-ivory p-6 md:p-8">
            <h2 className="font-body text-[11px] font-medium uppercase tracking-[0.16em] text-taupe">
              Google
            </h2>
            <a
              href={getGoogleProfileUrl() ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
              className="font-body mt-3 inline-block text-lg text-ink transition hover:text-deep-lavender"
            >
              Find us on Google
            </a>
            {getGoogleWriteReviewUrl() ? (
              <p className="font-body mt-2">
                <a
                  href={getGoogleWriteReviewUrl() ?? undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-taupe underline decoration-champagne underline-offset-4 hover:text-deep-lavender"
                >
                  Share a review
                </a>
              </p>
            ) : null}
          </section>
        ) : null}

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

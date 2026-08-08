import Link from "next/link";
import { Container } from "@/components/luxury/Container";

const faqPreview = [
  {
    q: "How does mobile grooming work?",
    a: "We bring a fully equipped, self-contained grooming salon directly to your home — one dog, one groomer, cage-free.",
  },
  {
    q: "Do you groom dogs over 45 lbs?",
    a: "Standard services are designed for dogs up to 45 lbs. Hand-stripping without bath and end-of-life comfort care may be available for larger dogs.",
  },
  {
    q: "What is your cancellation policy?",
    a: "48+ hours: no fee. Under 48 hours: 50%. Same-day or no-show: 100%.",
  },
] as const;

export function HomeFaqTeaser() {
  return (
    <section className="py-16 md:py-24">
      <Container>
        <div className="mx-auto max-w-3xl text-center">
          <p className="font-body text-[11px] font-medium uppercase tracking-[0.18em] text-taupe">
            FAQ
          </p>
          <h2 className="font-display mt-5 text-[2.5rem] leading-[1.08] text-ink md:text-4xl">
            Questions About Your Appointment
          </h2>
        </div>

        <div className="mx-auto mt-12 max-w-3xl divide-y divide-gray-line/80 border-y border-gray-line/80">
          {faqPreview.map((item) => (
            <details key={item.q} className="group py-6">
              <summary className="cursor-pointer list-none font-body text-sm font-medium text-ink marker:content-none [&::-webkit-details-marker]:hidden">
                <span className="flex items-start justify-between gap-4">
                  {item.q}
                  <span className="text-champagne transition group-open:rotate-45">
                    +
                  </span>
                </span>
              </summary>
              <p className="font-body mt-4 text-sm leading-relaxed text-taupe">
                {item.a}
              </p>
            </details>
          ))}
        </div>

        <div className="mt-10 text-center">
          <Link
            href="/faq"
            className="font-body inline-flex min-h-[48px] items-center text-[10px] font-medium uppercase tracking-[0.16em] text-deep-lavender transition hover:text-ink"
          >
            View All FAQ
          </Link>
        </div>
      </Container>
    </section>
  );
}

import Link from "next/link";
import { Container } from "@/components/luxury/Container";
import { CONSULTATION_PATH } from "@/lib/service-page";

export function ConsultationPrompt() {
  return (
    <section className="border-t border-gray-line/70 bg-ivory">
      <Container className="py-16 md:py-20">
        <div className="mx-auto max-w-xl text-center">
          <p className="font-body text-[12px] font-medium uppercase tracking-[0.18em] text-taupe">
            Not Sure Where to Start?
          </p>
          <h2 className="font-display mt-4 text-[2.5rem] leading-[1.12] text-ink md:text-4xl">
            A More Personal Recommendation
          </h2>
          <p className="font-body mt-5 text-base leading-relaxed text-taupe">
            Tell me a little about your dog and I’ll help you choose the care
            that suits them best.
          </p>
          <Link
            href={CONSULTATION_PATH}
            className="font-body mt-8 inline-flex min-h-[48px] items-center justify-center text-[12px] font-medium uppercase tracking-[0.16em] text-ink transition hover:text-deep-lavender focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne"
          >
            Request a Complimentary Consultation
            <span aria-hidden="true" className="ml-1.5">
              →
            </span>
          </Link>
        </div>
      </Container>
    </section>
  );
}

import Link from "next/link";
import { Container } from "@/components/luxury/Container";
import { Eyebrow } from "@/components/luxury/Eyebrow";
import { CONSULTATION_PATH } from "@/lib/service-page";

export function ConsultationPrompt() {
  return (
    <section className="border-t border-gray-line/60 bg-ivory">
      <Container className="py-16 md:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <Eyebrow>Not Sure Where to Start?</Eyebrow>
          <h2 className="font-display mt-5 text-[2.5rem] leading-[1.08] font-medium text-ink md:text-4xl">
            A More Personal Recommendation
          </h2>
          <p className="font-body mx-auto mt-5 max-w-2xl text-base leading-relaxed text-taupe md:text-[17px]">
            Tell me a little about your dog and I’ll help you choose the care
            that suits them best.
          </p>
          <Link
            href={CONSULTATION_PATH}
            className="font-body mt-8 inline-flex min-h-[48px] items-center justify-center text-[11px] font-medium uppercase tracking-[0.16em] text-deep-lavender transition hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne"
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

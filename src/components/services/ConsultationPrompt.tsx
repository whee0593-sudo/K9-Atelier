import Link from "next/link";
import { Container } from "@/components/luxury/Container";
import { Eyebrow } from "@/components/luxury/Eyebrow";
import { CONSULTATION_PATH } from "@/lib/service-page";

export function ConsultationPrompt() {
  return (
    <section className="border-t border-gray-line/50 bg-ivory">
      <Container className="py-20 md:py-28">
        <div className="mx-auto max-w-[34rem] text-center md:max-w-[36rem]">
          <Eyebrow>Not Sure Where to Start?</Eyebrow>
          <h2 className="font-display mt-4 text-[2rem] leading-[1.15] font-medium tracking-[-0.01em] text-pretty text-ink md:mt-5 md:text-[2.5rem] md:leading-[1.12]">
            A More Personal Recommendation
          </h2>
          <p className="font-body mx-auto mt-5 max-w-[30rem] text-base leading-[1.7] text-taupe md:text-[17px] md:leading-[1.75]">
            Tell me a little about your dog and I’ll help you choose the care
            that suits them best.
          </p>
          <Link
            href={CONSULTATION_PATH}
            className="font-body mt-9 inline-flex min-h-[48px] items-center justify-center text-[12px] font-medium uppercase tracking-[0.16em] text-deep-lavender transition hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne"
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

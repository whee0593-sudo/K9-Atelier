import Link from "next/link";
import { Container } from "@/components/luxury/Container";
import { CONSULTATION_PATH } from "@/lib/service-page";

export function ConsultationPrompt() {
  return (
    <section className="border-t border-gray-line/50 bg-ivory">
      <Container className="py-10 md:py-14">
        <div className="mx-auto max-w-[34rem] text-center md:max-w-[36rem]">
          <h2 className="font-display mt-4 text-[2rem] leading-[1.15] font-medium tracking-[-0.01em] text-pretty text-ink md:mt-5 md:text-[2.5rem] md:leading-[1.12]">
            Need help choosing?
          </h2>
          <Link
            href={CONSULTATION_PATH}
            className="font-body mt-6 inline-flex min-h-[48px] items-center justify-center text-sm font-medium uppercase tracking-[0.12em] text-deep-lavender transition hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne"
          >
            Ask a Question
            <span aria-hidden="true" className="ml-1.5">
              →
            </span>
          </Link>
        </div>
      </Container>
    </section>
  );
}

import Link from "next/link";
import { Container } from "@/components/luxury/Container";
import { BookServiceLink } from "@/components/booking/BookServiceLink";

export function HomeBookingCta() {
  return (
    <section className="border-b border-gray-line/60 py-16 md:py-24">
      <Container className="text-center">
        <p className="font-body text-[11px] font-medium uppercase tracking-[0.18em] text-taupe">
          Request an Appointment
        </p>
        <h2 className="font-display mx-auto mt-5 max-w-3xl text-[2.5rem] leading-[1.08] text-ink md:text-5xl">
          A Private Appointment Starts With a Conversation.
        </h2>
        <p className="font-body mx-auto mt-5 max-w-2xl text-base leading-relaxed text-taupe">
          Reserve a calm, one-on-one grooming experience for your dog. A valid
          payment method is required to confirm — you will not be charged when
          you book.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <BookServiceLink className="inline-flex min-h-[52px] items-center justify-center rounded-sm bg-deep-lavender px-8 text-[10px] font-medium uppercase tracking-[0.16em] text-ivory transition duration-500 hover:bg-ink">
            Request an Appointment
          </BookServiceLink>
          <Link
            href="/contact"
            className="inline-flex min-h-[52px] items-center justify-center rounded-sm border border-champagne px-8 text-[10px] font-medium uppercase tracking-[0.16em] text-ink transition hover:border-ink"
          >
            Email the Atelier
          </Link>
        </div>
      </Container>
    </section>
  );
}

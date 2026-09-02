import Link from "next/link";
import { Container } from "@/components/luxury/Container";
import { BookServiceLink } from "@/components/booking/BookServiceLink";

export function HomeBookingCta() {
  return (
    <section className="border-b border-gray-line/60 py-16 md:py-24">
      <Container className="text-center">
        <p className="font-body text-[12px] font-medium uppercase tracking-[0.18em] text-taupe">
          Book an Appointment
        </p>
        <h2 className="font-display mx-auto mt-5 max-w-3xl text-[2.5rem] leading-[1.08] text-ink md:text-5xl">
          A Private Spa Experience, Reserved for Your Dog.
        </h2>
        <p className="font-body mx-auto mt-5 max-w-2xl text-base leading-relaxed text-taupe">
          Book a calm, one-on-one grooming experience at a date and time that
          works for you. Add a card to complete your booking—you will not be
          charged at the time of booking.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <BookServiceLink className="inline-flex min-h-[52px] items-center justify-center rounded-sm bg-deep-lavender px-8 text-[11px] font-medium uppercase tracking-[0.16em] text-ivory transition duration-500 hover:bg-ink">
            Book an Appointment
          </BookServiceLink>
          <Link
            href="/contact?inquiry=grooming-consultation"
            className="inline-flex min-h-[52px] items-center justify-center rounded-sm border border-champagne px-8 text-[11px] font-medium uppercase tracking-[0.16em] text-ink transition hover:border-ink"
          >
            Request a Consultation
          </Link>
        </div>
      </Container>
    </section>
  );
}

import { BookServiceLink } from "@/components/booking/BookServiceLink";
import { Container } from "@/components/luxury/Container";
import { Eyebrow } from "@/components/luxury/Eyebrow";

export function ServicesHero() {
  return (
    <section className="bg-ivory px-5 pb-12 pt-14 md:px-12 md:pb-16 md:pt-20 xl:px-20">
      <Container className="px-0">
        <header className="mx-auto max-w-3xl text-center">
          <Eyebrow>Signature Services</Eyebrow>
          <h1 className="font-display mt-5 text-[2.5rem] leading-[1.08] font-medium text-ink md:text-5xl">
            Grooming, Considered
            <br />
            Down to Every Detail.
          </h1>
          <p className="font-body mx-auto mt-6 max-w-xl text-base leading-relaxed text-taupe md:text-[17px]">
            Private, one-on-one mobile grooming tailored to your dog’s coat,
            comfort and individual needs.
          </p>
          <p className="font-body mx-auto mt-4 max-w-xl text-sm text-taupe">
            Dogs up to 45 lbs · By appointment only
            <br />
            Serving Jupiter, Palm Beach Gardens &amp; West Palm Beach
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a
              href="#most-requested"
              className="inline-flex min-h-[52px] items-center justify-center rounded-sm border border-champagne bg-transparent px-7 text-[10px] font-medium uppercase tracking-[0.16em] text-ink transition hover:border-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne"
            >
              Explore Services
            </a>
            <BookServiceLink className="inline-flex min-h-[52px] items-center justify-center rounded-sm bg-deep-lavender px-7 text-[10px] font-medium uppercase tracking-[0.16em] text-ivory transition hover:bg-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne">
              Request an Appointment
            </BookServiceLink>
          </div>
          <p className="font-body mx-auto mt-6 max-w-xl text-xs leading-relaxed text-taupe">
            Starting prices may vary based on coat condition, temperament,
            styling requirements and appointment time.
          </p>
        </header>
      </Container>
    </section>
  );
}

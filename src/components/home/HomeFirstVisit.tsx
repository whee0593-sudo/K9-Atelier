import { BookServiceLink } from "@/components/booking/BookServiceLink";
import { Container } from "@/components/luxury/Container";
import { SectionIntro } from "@/components/luxury/SectionIntro";
import { homeFirstVisitSteps } from "@/components/home/home-first-visit";

export function HomeFirstVisit() {
  return (
    <section
      id="first-visit"
      className="scroll-mt-24 border-b border-gray-line/60 py-16 md:py-20"
    >
      <Container>
        <SectionIntro eyebrow="Your First Visit" title="What to Expect" />

        <ol className="mt-10 grid list-none gap-8 p-0 md:mt-14 md:grid-cols-4 md:gap-8">
          {homeFirstVisitSteps.map((step) => (
            <li
              key={step.number}
              className="border-t border-champagne/55 pt-5 text-left md:pt-6"
            >
              <p className="font-body text-[12px] font-medium uppercase tracking-[0.18em] text-champagne">
                {step.number} —
              </p>
              <h3 className="font-body mt-3 text-[13px] font-semibold uppercase tracking-[0.14em] text-ink">
                {step.title}
              </h3>
              <p className="font-body mt-4 text-sm leading-relaxed text-taupe">
                {step.body}
              </p>
            </li>
          ))}
        </ol>

        <div className="mt-12 text-center md:mt-14">
          <BookServiceLink className="inline-flex min-h-[52px] w-full items-center justify-center rounded-sm bg-deep-lavender px-8 text-[13px] font-medium uppercase tracking-[0.14em] text-ivory transition duration-500 hover:bg-ink motion-reduce:transition-none md:w-auto md:text-[12px] md:tracking-[0.16em]">
            Book an Appointment
          </BookServiceLink>
        </div>
      </Container>
    </section>
  );
}

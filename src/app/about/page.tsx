import Link from "next/link";
import { Container } from "@/components/luxury/Container";

export const metadata = {
  title: "About · K9 Atelier",
  description:
    "The story behind K9 Atelier — Penny's work in professional grooming, show styling, and education since 2010, now a private mobile pet spa in Palm Beach.",
};

const experience = [
  {
    kicker: "Since 2010",
    role: "Professional Groomer",
    detail: "Dedicated to the craft of professional grooming.",
  },
  {
    kicker: "Shanghai",
    role: "Former Head Groomer",
    detail: "Premier luxury dog salon.",
  },
  {
    kicker: "5 Years",
    role: "Professional Educator",
    detail: "Asian fusion & show styling.",
  },
] as const;

const honors = [
  { year: "2014", title: "Best in Group · Pomeranian" },
  { year: "2017", title: "Best in Group · Poodle" },
  { year: "2019", title: "Best in Show · Bichon" },
] as const;

const sectionRule = "border-t border-champagne/25";
const sectionSpace = "mt-20 pt-16 md:mt-28 md:pt-20 lg:mt-32 lg:pt-24";
const sectionLabel =
  "font-body text-[13px] font-medium uppercase tracking-[0.2em] text-deep-lavender md:text-sm";

export default function AboutPage() {
  return (
    <div className="overflow-x-clip">
      <Container>
        <div className="mx-auto max-w-[1160px] pb-20 pt-16 md:pb-28 md:pt-24">
          <header className="mx-auto max-w-[46rem] text-center">
            <p className={sectionLabel}>Precision. Patience. Purpose.</p>
            <h1 className="font-display mt-6 text-[2.875rem] leading-[1.12] font-medium tracking-[-0.01em] text-ink md:mt-8 md:text-[3.5rem] lg:text-[3.75rem]">
              The Story Behind
              <br />
              K9 Atelier
            </h1>
            <div className="font-body mx-auto mt-8 max-w-[44rem] space-y-6 text-lg leading-[1.8] text-taupe md:mt-10 md:text-[1.25rem] md:leading-[1.85]">
              <p>
                K9 Atelier is the work of Penny, an award-winning show groomer whose
                approach has been shaped by professional grooming, show styling,
                and education since 2010.
              </p>
              <p>
                <span className="font-display text-[1.05em] text-ink italic">
                  Atelier
                </span>{" "}
                reflects the philosophy behind her work — craftsmanship refined
                through patience, precision, and an individual approach to every
                dog.
              </p>
            </div>
          </header>

          <section
            className={`${sectionRule} ${sectionSpace} mx-auto max-w-[1020px]`}
            aria-labelledby="about-experience"
          >
            <h2 id="about-experience" className={sectionLabel}>
              Experience
            </h2>
            <ul className="mt-10 grid grid-cols-1 gap-14 md:mt-14 md:grid-cols-3 md:gap-10 lg:gap-16">
              {experience.map((item) => (
                <li key={item.kicker} className="min-w-0">
                  <p className="font-display text-[2.5rem] leading-none text-ink md:text-[2.75rem]">
                    {item.kicker}
                  </p>
                  <p className="font-body mt-5 text-lg leading-snug text-ink">
                    {item.role}
                  </p>
                  <p className="font-body mt-3 text-base leading-relaxed text-taupe md:text-[17px]">
                    {item.detail}
                  </p>
                </li>
              ))}
            </ul>
          </section>

          <section
            className={`${sectionRule} ${sectionSpace} mx-auto max-w-[920px]`}
            aria-labelledby="about-honors"
          >
            <h2 id="about-honors" className={sectionLabel}>
              Show Honors
            </h2>
            <p className="font-body mt-5 max-w-lg text-lg leading-relaxed text-taupe">
              Competition achievements in professional grooming.
            </p>
            <ul className="mt-10 md:mt-12">
              {honors.map((honor) => (
                <li
                  key={honor.year}
                  className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-baseline gap-x-6 border-t border-champagne/20 py-8 sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-x-10 md:py-9"
                >
                  <p className="font-display text-[2rem] leading-none text-ink md:text-[2.25rem]">
                    {honor.year}
                  </p>
                  <p className="font-body text-lg leading-relaxed text-taupe md:text-xl">
                    {honor.title}
                  </p>
                </li>
              ))}
            </ul>
          </section>

          <section
            className={`${sectionRule} ${sectionSpace} mx-auto max-w-[44rem] text-center`}
            aria-labelledby="about-standard"
          >
            <h2
              id="about-standard"
              className="font-display text-[2.5rem] leading-[1.15] font-medium text-ink md:text-[2.875rem]"
            >
              A Different Standard of Care
            </h2>
            <div className="font-body mt-8 space-y-6 text-lg leading-[1.8] text-taupe md:mt-10 md:text-[1.25rem] md:leading-[1.85]">
              <p>
                Today, that same standard continues at K9 Atelier — a private,
                cage-free mobile pet spa serving Palm Beach.
              </p>
              <p>
                Every appointment is one-on-one and unhurried, with thoughtful
                attention to coat health, comfort, structure, and finish. The
                goal is not simply a beautiful groom, but work that respects the
                individual dog.
              </p>
            </div>
            <p className={`${sectionLabel} mt-12 md:mt-14`}>
              Private · One-on-One · Cage-Free
            </p>
            <Link
              href="/services"
              className="group font-body mt-10 inline-flex min-h-[52px] items-center gap-3 border border-champagne px-9 text-[13px] font-medium uppercase tracking-[0.16em] text-ink transition duration-500 hover:border-ink hover:text-deep-lavender focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne motion-reduce:transition-none md:mt-12"
            >
              Explore Services
              <span
                aria-hidden="true"
                className="transition-transform duration-500 group-hover:translate-x-1 motion-reduce:transform-none"
              >
                →
              </span>
            </Link>
          </section>
        </div>
      </Container>
    </div>
  );
}

import { Container } from "@/components/luxury/Container";
import { SectionIntro } from "@/components/luxury/SectionIntro";

const benefits = [
  {
    title: "Private",
    body: "One-on-one appointments",
  },
  {
    title: "Cage-Free",
    body: "A calm, uninterrupted environment",
  },
  {
    title: "Unhurried",
    body: "Care guided by the dog, not the clock",
  },
  {
    title: "Expert",
    body: "Award-winning professional grooming",
  },
] as const;

export function HomeExperience() {
  return (
    <section id="experience" className="scroll-mt-24 border-b border-gray-line/60 py-16 md:py-24">
      <Container>
        <SectionIntro
          eyebrow="The K9 Atelier Experience"
          title={
            <>
              A Different Kind of
              <br />
              Grooming Experience
            </>
          }
          body={
            <>
              <p>No crowded salon. No cages. No waiting.</p>
              <p className="mt-4">
                Just one dog, one groomer, and an appointment reserved entirely
                for them.
              </p>
            </>
          }
        />

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {benefits.map((item) => (
            <article
              key={item.title}
              className="border border-gray-line/80 bg-ivory px-6 py-8"
            >
              <h3 className="font-body text-[11px] font-semibold uppercase tracking-[0.18em] text-deep-lavender">
                {item.title}
              </h3>
              <p className="font-body mt-4 text-sm leading-relaxed text-taupe">
                {item.body}
              </p>
            </article>
          ))}
        </div>
      </Container>
    </section>
  );
}

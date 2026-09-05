import { Container } from "@/components/luxury/Container";
import { SectionIntro } from "@/components/luxury/SectionIntro";

const pillars = [
  {
    title: "Unhurried",
    body: "Care guided by the dog, not the clock",
  },
  {
    title: "Expert",
    body: "Award-winning professional grooming",
  },
  {
    title: "Save Your Time",
    body: "We come to you — no travel, no waiting rooms.",
  },
] as const;

export function HomeExpertise() {
  return (
    <section className="border-b border-gray-line/60 bg-dusty-lavender/25 py-16 md:py-24">
      <Container>
        <SectionIntro
          eyebrow="The Art of Grooming"
          title={
            <>
              Award-Winning Expertise.
              <br />A More Personal Standard of Care.
            </>
          }
          body={
            <>
              <p>Expertise is at the heart of K9 Atelier.</p>
              <p className="mt-4">
                Beginning her grooming career in 2010, Penny went on to teach
                Asian-fusion and show grooming at a professional grooming
                academy in Shanghai, while competing extensively with
                Pomeranians, Poodles and Shih Tzus.
              </p>
              <p className="mt-4">
                In 2019, that pursuit of craftsmanship culminated in Best in Show
                at a national grooming competition.
              </p>
              <p className="mt-4">
                Today, that same precision, patience and artistry define every K9
                Atelier appointment.
              </p>
            </>
          }
        />

        <ul className="mx-auto mt-12 max-w-xl list-none divide-y divide-gray-line/70 p-0 md:mt-14">
          {pillars.map((item) => (
            <li key={item.title} className="py-6 first:pt-0 last:pb-0 md:py-7">
              <p className="font-body text-[12px] font-semibold uppercase tracking-[0.18em] text-ink">
                {item.title}
              </p>
              <p className="font-body mt-2 text-[14px] leading-[1.7] text-taupe md:text-sm md:leading-relaxed">
                {item.body}
              </p>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}

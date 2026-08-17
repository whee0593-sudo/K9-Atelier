import { Container } from "@/components/luxury/Container";
import { SectionIntro } from "@/components/luxury/SectionIntro";

const stats = [
  { label: "Professional Grooming", value: "Since 2010" },
  { label: "Best in Show", value: "2019" },
  { label: "Private", value: "One-on-One" },
  { label: "Cage-Free", value: "By Design" },
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

        <div className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((item) => (
            <div
              key={item.label}
              className="border-t border-champagne/60 pt-6 text-center"
            >
              <p className="font-body text-[11px] font-medium uppercase tracking-[0.2em] text-taupe">
                {item.label}
              </p>
              <p className="font-display mt-3 text-3xl text-ink md:text-4xl">
                {item.value}
              </p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

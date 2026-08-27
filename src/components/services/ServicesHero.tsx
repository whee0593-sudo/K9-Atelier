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
          <p className="font-body mx-auto mt-6 max-w-xl text-xs leading-relaxed text-taupe">
            Starting prices may vary based on coat condition, temperament,
            styling requirements and appointment time.
          </p>
        </header>
      </Container>
    </section>
  );
}

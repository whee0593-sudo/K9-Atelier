import { Container } from "@/components/luxury/Container";
import { Eyebrow } from "@/components/luxury/Eyebrow";

export function ServicesHero() {
  return (
    <section className="bg-ivory pb-8 pt-12 md:pb-10 md:pt-16 lg:pb-12 lg:pt-[4.25rem]">
      <Container>
        <header className="mx-auto max-w-[36rem] text-center md:max-w-[40rem]">
          <Eyebrow>Signature Services</Eyebrow>
          <h1 className="font-display mt-4 text-[clamp(2.125rem,6.4vw,3.25rem)] leading-[1.12] font-medium tracking-[-0.01em] text-pretty text-ink md:mt-5 md:leading-[1.08]">
            Grooming, Considered
            <br />
            Down to Every Detail.
          </h1>
          <p className="font-body mx-auto mt-5 max-w-[28rem] text-base leading-[1.7] text-taupe md:mt-6 md:max-w-[32rem] md:text-[17px] md:leading-[1.75]">
            Private, one-on-one mobile grooming tailored to your dog.
          </p>
          <p className="font-body mx-auto mt-3 text-[13px] leading-relaxed text-taupe md:mt-4 md:text-sm">
            Dogs up to 45 lbs · By appointment only
          </p>
        </header>
      </Container>
    </section>
  );
}

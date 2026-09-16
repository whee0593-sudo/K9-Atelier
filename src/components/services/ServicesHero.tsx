import { Container } from "@/components/luxury/Container";
import { Eyebrow } from "@/components/luxury/Eyebrow";

export function ServicesHero() {
  return (
    <section className="bg-ivory px-5 pb-10 pt-12 md:px-12 md:pb-12 md:pt-16 xl:px-20">
      <Container className="px-0">
        <header className="mx-auto max-w-xl text-center">
          <Eyebrow>Signature Services</Eyebrow>
          <h1 className="font-display mt-5 text-[2.25rem] leading-[1.08] font-medium text-ink md:text-[2.75rem]">
            Grooming, Considered
            <br />
            Down to Every Detail.
          </h1>
          <p className="font-body mx-auto mt-5 max-w-md text-base leading-relaxed text-taupe">
            Private, one-on-one mobile grooming tailored to your dog.
          </p>
          <p className="font-body mx-auto mt-4 text-[12px] tracking-[0.02em] text-taupe/80">
            Dogs up to 45 lbs · By appointment only
          </p>
        </header>
      </Container>
    </section>
  );
}

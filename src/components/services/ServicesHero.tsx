import { Container } from "@/components/luxury/Container";
import { Eyebrow } from "@/components/luxury/Eyebrow";
import {
  servicesBodyClass,
  servicesHeroTitleClass,
  servicesSupportClass,
} from "@/components/services/services-type";

export function ServicesHero() {
  return (
    <section className="bg-ivory pb-14 pt-16 md:pb-20 md:pt-24">
      <Container>
        <header className="mx-auto max-w-3xl text-center">
          <Eyebrow>Signature Services</Eyebrow>
          <h1 className={servicesHeroTitleClass}>
            Grooming, Considered
            <br />
            Down to Every Detail.
          </h1>
          <p className={`${servicesBodyClass} mx-auto mt-7 max-w-xl`}>
            Private, one-on-one mobile grooming tailored to your dog.
          </p>
          <p className={`${servicesSupportClass} mx-auto mt-5`}>
            Dogs up to 45 lbs · By appointment only
          </p>
        </header>
      </Container>
    </section>
  );
}

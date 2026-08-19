import Link from "next/link";
import { Container } from "@/components/luxury/Container";
import { SectionIntro } from "@/components/luxury/SectionIntro";

const services = [
  {
    title: "The Signature Bath",
    body: "Coat-specific cleansing, conditioning, hand drying and meticulous finishing.",
    price: "From $90",
    href: "/services#signature-bath",
    cta: "Discover",
  },
  {
    title: "The Atelier Groom",
    body: "A complete grooming experience finished with a bespoke haircut tailored to your dog's coat, lifestyle and individual expression.",
    price: "From $150",
    href: "/services#atelier-full-groom",
    cta: "Discover",
  },
  {
    title: "Spa Rituals",
    body: "Thoughtfully selected skin, coat and wellness rituals inspired by the quiet luxury of a private hotel spa.",
    price: "From $140",
    href: "/services#spa-wellness",
    cta: "Explore Spa Rituals",
  },
] as const;

export function HomeSignatureServices() {
  return (
    <section className="border-b border-gray-line/60 py-16 md:py-24">
      <Container>
        <SectionIntro
          eyebrow="Signature Services"
          title={
            <>
              Grooming, Considered
              <br />
              Down to Every Detail.
            </>
          }
        />

        <div className="mt-14 grid gap-8 lg:grid-cols-3">
          {services.map((service) => (
            <article
              key={service.title}
              className="flex flex-col border border-gray-line/80 bg-ivory p-8"
            >
              <h3 className="font-display text-3xl text-ink">{service.title}</h3>
              <p className="font-body mt-4 flex-1 text-sm leading-relaxed text-taupe">
                {service.body}
              </p>
              <p className="font-body mt-6 text-[12px] font-medium uppercase tracking-[0.14em] text-taupe">
                {service.price}
              </p>
              <Link
                href={service.href}
                className="font-body mt-6 inline-flex min-h-[48px] items-center text-[11px] font-medium uppercase tracking-[0.16em] text-deep-lavender transition hover:text-ink"
              >
                {service.cta}
              </Link>
            </article>
          ))}
        </div>

        <div className="mt-12 text-center">
          <Link
            href="/services"
            className="font-body inline-flex min-h-[52px] items-center justify-center border border-champagne px-8 text-[11px] font-medium uppercase tracking-[0.16em] text-ink transition hover:border-ink"
          >
            View All Services
          </Link>
        </div>
      </Container>
    </section>
  );
}

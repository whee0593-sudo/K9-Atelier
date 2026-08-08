import Link from "next/link";
import { Container } from "@/components/luxury/Container";
import { SectionIntro } from "@/components/luxury/SectionIntro";

const spaServices = [
  {
    title: "Dead Sea Mineral Ritual",
    body: "Mineral-rich Dead Sea mud care paired with gentle body massage and meticulous coat finishing.",
    bestFor: "Heavy double coats and high-shedding breeds.",
  },
  {
    title: "Lavender & Chamomile Bath Ritual",
    body: "A warm bathing ritual with pet-appropriate lavender and chamomile care, paired with gentle massage and careful coat finishing.",
    bestFor: "Dry, dull or tangle-prone coats.",
  },
  {
    title: "Sensitive Skin Botanical Ritual",
    body: "Gentle botanical and oatmeal/aloe-based care created for dogs with dry or sensitive skin.",
    bestFor: "Dry or sensitive skin.",
  },
] as const;

const inclusions = [
  "Gentle blow-dry",
  "Brush-out",
  "Nail trim & dremel",
  "Ear cleaning",
  "Teeth brushing",
  "Mini groom",
  "Sanitary trim",
  "Paw pad trim",
] as const;

export function HomeSpaWellness() {
  return (
    <section className="border-b border-gray-line/60 py-16 md:py-24">
      <Container>
        <SectionIntro
          eyebrow="Spa & Wellness"
          title={
            <>
              Quiet Rituals for
              <br />
              Skin, Coat & Comfort.
            </>
          }
          body="A slower, more sensory grooming experience designed around coat condition, skin comfort and relaxation."
        />

        <div className="mt-14 grid gap-8 lg:grid-cols-3">
          {spaServices.map((service) => (
            <article
              key={service.title}
              className="border border-gray-line/80 bg-ivory p-8"
            >
              <h3 className="font-display text-2xl text-ink">{service.title}</h3>
              <p className="font-body mt-4 text-sm leading-relaxed text-taupe">
                {service.body}
              </p>
              <p className="font-body mt-4 text-xs leading-relaxed text-taupe">
                <span className="font-medium uppercase tracking-[0.12em] text-ink">
                  Best for:
                </span>{" "}
                {service.bestFor}
              </p>
              <p className="font-body mt-6 text-[11px] font-medium uppercase tracking-[0.14em] text-taupe">
                From $120 · 60–90 min
              </p>
            </article>
          ))}
        </div>

        <div className="mt-12 border border-gray-line/80 bg-dusty-lavender/20 p-8 md:p-10">
          <p className="font-body text-[11px] font-medium uppercase tracking-[0.16em] text-taupe">
            All spa treatments include
          </p>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2 md:grid-cols-4">
            {inclusions.map((item) => (
              <li key={item} className="font-body text-sm text-ink">
                {item}
              </li>
            ))}
          </ul>
          <p className="font-body mt-6 text-sm leading-relaxed text-taupe">
            For your dog&apos;s comfort, Spa Rituals are best scheduled separately
            from a full haircut/styling appointment.
          </p>
          <Link
            href="/services#spa-wellness"
            className="font-body mt-6 inline-flex min-h-[48px] items-center text-[10px] font-medium uppercase tracking-[0.16em] text-deep-lavender transition hover:text-ink"
          >
            View Spa Pricing & Details
          </Link>
        </div>
      </Container>
    </section>
  );
}

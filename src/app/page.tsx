import Link from "next/link";
import Image from "next/image";
import { business } from "@/lib/business";

export default function HomePage() {
  const featured = business.serviceCategories[0].services.slice(0, 2);

  return (
    <>
      <section className="mx-auto max-w-5xl px-6 py-16 md:py-24">
        <div className="grid items-center gap-12 md:grid-cols-2">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-gold">
              Mobile Pet Grooming
            </p>
            <h1 className="mt-4 text-4xl font-semibold leading-tight text-text md:text-5xl">
              {business.brand.name}
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-text-muted">
              {business.brand.tagline}
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                href="/book"
                className="rounded-full bg-gold px-6 py-3 text-sm font-medium text-white transition hover:bg-gold-dark"
              >
                Book Appointment
              </Link>
              <Link
                href="/services"
                className="rounded-full border border-gold px-6 py-3 text-sm font-medium text-gold-dark transition hover:bg-lavender-light"
              >
                View Services
              </Link>
            </div>
            <p className="mt-6 text-sm text-text-muted">
              ${business.booking.depositAmount} deposit required · Mon–Fri 9 AM–4 PM
            </p>
          </div>
          <div className="flex justify-center">
            <Image
              src={business.brand.logo}
              alt={business.brand.name}
              width={320}
              height={320}
              className="rounded-full shadow-lg ring-4 ring-lavender-light"
              priority
            />
          </div>
        </div>
      </section>

      <section className="bg-lavender-light/50 py-16">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="text-center text-2xl font-semibold text-gold-dark">
            Signature Services
          </h2>
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {featured.map((service) => (
              <div
                key={service.id}
                className="rounded-2xl border border-lavender/40 bg-cream p-6"
              >
                <h3 className="text-lg font-medium text-text">{service.name}</h3>
                <p className="mt-3 text-sm leading-relaxed text-text-muted">
                  {service.description}
                </p>
                {"tiers" in service && service.tiers && (
                  <p className="mt-4 text-sm font-medium text-gold-dark">
                    From ${service.tiers[0].priceFrom}
                  </p>
                )}
              </div>
            ))}
          </div>
          <p className="mt-8 text-center">
            <Link href="/services" className="text-sm text-gold-dark underline">
              See full menu & pricing
            </Link>
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-16">
        <div className="rounded-2xl bg-lavender/30 p-8 text-center md:p-12">
          <h2 className="text-2xl font-semibold text-gold-dark">
            We Come to You
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-text-muted">
            Free travel within {business.serviceArea.freeRadiusMiles} miles.
            Beyond that, ${business.serviceArea.travelFeePerMile}/mile one-way
            (max {business.serviceArea.maxDistanceMiles} miles).
          </p>
          <Link
            href="/service-area"
            className="mt-6 inline-block text-sm font-medium text-gold-dark underline"
          >
            Service area details
          </Link>
        </div>
      </section>
    </>
  );
}

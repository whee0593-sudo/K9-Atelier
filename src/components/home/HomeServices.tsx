import React from "react";
import Link from "next/link";
import Image from "next/image";
import { galleryPhotos } from "@/lib/gallery";
import { Container } from "@/components/luxury/Container";
import {
  SERVICE_CATEGORIES,
  directoryPriceLabel,
  type ServiceCategory,
} from "@/lib/service-page";

export const homeServicesHeading = "Grooming, tailored to the individual.";

const HOME_SERVICE_SLUGS = [
  "full-groom",
  "bath-coat-care",
  "hand-stripping",
  "spa",
  "color",
  "specialty-care",
] as const;

export const homeServiceLinks = HOME_SERVICE_SLUGS.map((slug) => {
  const category = SERVICE_CATEGORIES.find((item) => item.slug === slug);
  if (!category) {
    throw new Error(`Missing homepage service category: ${slug}`);
  }
  return category;
});

// Existing portfolio photographs; do not generate or alter grooming results.
const SERVICE_PHOTO_IDS: Record<string, string> = {
  "full-groom": "teddy-bear-silver",
  "bath-coat-care": "teddy-bear-cream",
  "hand-stripping": "westie",
  spa: "teddy-bear-apricot",
  color: "creative-color",
  "specialty-care": "schnauzer",
  "add-ons": "poodle-finish",
};

function HomeServiceCard({
  category,
  showPrices,
}: {
  category: ServiceCategory;
  showPrices: boolean;
}) {
  const photo = category.slug === "bath-coat-care"
    ? {
        src: "/images/services/bath-coat-care-shih-tzu.webp",
        alt: "Brown and white Shih Tzu showing a smooth, brushed coat",
      }
    : category.slug === "color"
      ? {
          src: "/images/services/creative-color-art.webp",
          alt: "White dog with yellow-orange ears and colorful creative coat artwork",
        }
      : category.slug === "hand-stripping"
        ? {
            src: "/images/services/hand-stripping-terrier.webp",
            alt: "Red wire-coated terrier standing in a hand-stripped coat",
          }
        : category.slug === "spa"
          ? {
              src: "/images/services/luxury-spa-day.webp",
              alt: "Fluffy apricot dog sitting after a spa grooming session",
            }
          : galleryPhotos.find((item) => item.id === SERVICE_PHOTO_IDS[category.slug]);
  const price = showPrices ? directoryPriceLabel(category) : null;

  return (
    <li className="min-w-0">
      <Link
        href={category.path}
        className="group grid h-full w-full grid-cols-[96px_minmax(0,1fr)] items-center gap-4 overflow-hidden rounded-xl border border-transparent bg-ivory p-3 text-left transition-colors hover:border-deep-lavender focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-deep-lavender sm:grid-cols-[128px_minmax(0,1fr)] md:flex md:flex-col md:items-stretch md:gap-0 md:p-4"
      >
        {photo ? (
          <Image src={photo.src} alt={photo.alt} width={640} height={720}
            sizes="(max-width: 639px) 96px, (max-width: 767px) 128px, (max-width: 1023px) calc((100vw - 9rem) / 2), 305px"
            loading="lazy" quality={75}
            className="h-[116px] w-full rounded-lg bg-dusty-lavender/30 object-contain sm:h-[140px] md:h-[220px]" />
        ) : null}
        <div className="min-w-0 md:pt-5">
        <h3 className="font-display text-[1.4rem] leading-[1.15] font-semibold text-ink md:text-3xl">
          {category.directoryName}
        </h3>
        <p className="font-body mt-2 text-sm leading-relaxed md:text-base text-ink">
          {category.directoryDescription}
        </p>
        {price ? (
          <p className="font-body mt-5 min-h-[1.5rem] text-base font-medium tracking-[0.01em] text-ink md:min-h-[1.7rem] md:text-[17px]">
            {price}
          </p>
        ) : null}
        <span className="font-body mt-1 inline-flex min-h-[44px] items-center text-sm font-semibold text-deep-lavender transition duration-500 group-hover:text-ink motion-reduce:transition-none md:mt-3">
          Explore
          <span
            aria-hidden="true"
            className="ml-1.5 inline-block transition-transform duration-500 group-hover:translate-x-1 motion-reduce:transition-none"
          >
            →
          </span>
        </span>
        </div>
      </Link>
    </li>
  );
}

export function HomeServices({ showPrices = false }: { showPrices?: boolean }) {
  return (
    <section
      aria-labelledby="home-services-heading"
      className="bg-dusty-lavender py-12 md:py-16"
    >
      <Container>
        <div className="mx-auto max-w-3xl text-center">
          <h2
            id="home-services-heading"
            className="font-display text-pretty text-[2.25rem] leading-[1.08] font-medium text-ink md:text-5xl lg:text-[3.5rem]"
          >
            {homeServicesHeading}
          </h2>
        </div>

        <ul className="mt-8 grid list-none grid-cols-1 gap-3 p-0 md:mt-10 md:grid-cols-2 md:gap-5 lg:grid-cols-3">
          {homeServiceLinks.map((category) => (
            <HomeServiceCard
              key={category.slug}
              category={category}
              showPrices={showPrices}
            />
          ))}
        </ul>
      </Container>
    </section>
  );
}

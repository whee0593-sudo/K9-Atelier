import React from "react";
import Link from "next/link";
import Image from "next/image";
import { galleryPhotos } from "@/lib/gallery";
import { Container } from "@/components/luxury/Container";
import { LONG_COAT_CARE_PATH } from "@/lib/long-coat-care-page";
import {
  SERVICE_CATEGORIES,
  SERVICES_DIRECTORY_DESCRIPTIONS,
  directoryPriceLabel,
  type ServiceCategory,
} from "@/lib/service-page";

const cardClass =
  "group grid h-full w-full grid-cols-[96px_minmax(0,1fr)] items-center gap-4 overflow-hidden rounded-xl border border-transparent bg-ivory p-3 text-left transition-colors hover:border-deep-lavender focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-deep-lavender sm:grid-cols-[128px_minmax(0,1fr)] md:flex md:flex-col md:items-stretch md:gap-0 md:p-4";

const titleClass =
  "font-display text-[1.4rem] leading-[1.15] font-semibold text-ink md:text-3xl";

const descriptionClass = "font-body mt-2 text-sm leading-relaxed text-ink md:text-base";

const priceClass =
  "font-body mt-5 min-h-[1.5rem] text-base font-medium tracking-[0.01em] text-ink md:min-h-[1.7rem] md:text-[17px]";

const exploreClass =
  "font-body mt-auto inline-flex min-h-[44px] items-center text-sm font-semibold text-deep-lavender transition duration-500 group-hover:text-ink motion-reduce:transition-none md:mt-3";

function ExploreLabel() {
  return (
    <span className={exploreClass}>
      Explore
      <span
        aria-hidden="true"
        className="ml-1.5 inline-block transition-transform duration-500 group-hover:translate-x-1 motion-reduce:transition-none"
      >
        →
      </span>
    </span>
  );
}

function PriceLine({ price }: { price: string | null }) {
  if (!price) {
    return null;
  }

  return <p className={priceClass}>{price}</p>;
}

// Match the homepage portfolio choices; Add-On Care has its own existing photo.
const SERVICE_PHOTO_IDS: Record<string, string> = {
  "full-groom": "teddy-bear-silver",
  "bath-coat-care": "teddy-bear-cream",
  "hand-stripping": "westie",
  spa: "teddy-bear-apricot",
  color: "creative-color",
  "specialty-care": "schnauzer",
  "add-ons": "poodle-finish",
};

function DirectoryPhoto({ slug }: { slug: string }) {
  const photo = slug === "bath-coat-care"
    ? {
        src: "/images/services/bath-coat-care-shih-tzu.webp",
        alt: "Brown and white Shih Tzu showing a smooth, brushed coat",
      }
    : galleryPhotos.find((item) => item.id === SERVICE_PHOTO_IDS[slug]);
  if (!photo) return null;
  return (
    <Image
      src={photo.src}
      alt={photo.alt}
      width={640}
      height={720}
      sizes="(max-width: 639px) 96px, (max-width: 767px) 128px, (max-width: 1023px) calc((100vw - 9rem) / 2), 305px"
      loading="lazy"
      quality={75}
      className="h-[116px] w-full rounded-lg bg-dusty-lavender/30 object-contain sm:h-[140px] md:h-[220px]"
    />
  );
}

function DirectoryCard({
  category,
  showPrices,
}: {
  category: ServiceCategory;
  showPrices: boolean;
}) {
  const price = showPrices ? directoryPriceLabel(category) : null;
  const description = SERVICES_DIRECTORY_DESCRIPTIONS[category.slug];

  if (category.slug !== "bath-coat-care") {
    return (
      <Link href={category.path} className={cardClass}>
        <DirectoryPhoto slug={category.slug} />
        <div className="flex min-w-0 flex-col md:flex-1 md:pt-5">
        <h2 className={titleClass}>{category.directoryName}</h2>
        <p className={descriptionClass}>{description}</p>
        <PriceLine price={price} />
        <ExploreLabel />
        </div>
      </Link>
    );
  }

  return (
    <div className={`relative ${cardClass}`}>
      <DirectoryPhoto slug={category.slug} />
      <div className="flex min-w-0 flex-col md:flex-1 md:pt-5">
      <h2 className={titleClass}>
        <Link
          href={category.path}
          className="after:absolute after:inset-0 after:z-[1] after:content-[''] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-champagne"
        >
          {category.directoryName}
        </Link>
      </h2>
      <p className={descriptionClass}>{description}</p>
      <Link
        href={LONG_COAT_CARE_PATH}
        className="font-body relative z-[2] mt-4 inline-flex min-h-12 max-w-full items-center self-start text-left text-sm leading-snug text-deep-lavender underline decoration-champagne/70 underline-offset-4 transition duration-500 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne motion-reduce:transition-none"
      >
        Show-Level Coat Care
      </Link>
      <PriceLine price={price} />
      <ExploreLabel />
      </div>
    </div>
  );
}

export function ServiceDirectory({ showPrices = false }: { showPrices?: boolean }) {
  return (
    <section aria-label="Service directory" className="bg-dusty-lavender py-12 md:py-16">
      <Container>
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-5 lg:grid-cols-3">
          {SERVICE_CATEGORIES.map((category) => (
            <li
              key={category.slug}
              className="min-h-0 w-full md:last:col-span-2 md:last:w-[calc((100%-1.25rem)/2)] md:last:justify-self-center lg:last:col-span-1 lg:last:col-start-2 lg:last:w-auto lg:last:justify-self-stretch"
            >
              <DirectoryCard category={category} showPrices={showPrices} />
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}

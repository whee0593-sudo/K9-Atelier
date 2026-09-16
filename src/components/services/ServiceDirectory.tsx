import Link from "next/link";
import { Container } from "@/components/luxury/Container";
import {
  SERVICE_CATEGORIES,
  directoryPriceLabel,
} from "@/lib/service-page";

export function ServiceDirectory() {
  return (
    <section aria-label="Service directory" className="bg-ivory px-5 pb-16 md:px-12 md:pb-20 xl:px-20">
      <Container className="px-0">
        <ul className="mx-auto grid max-w-[22.5rem] grid-cols-1 gap-y-8 md:max-w-[46rem] md:grid-cols-2 md:gap-x-10 md:gap-y-10 lg:max-w-[70rem] lg:grid-cols-3 lg:gap-x-12">
          {SERVICE_CATEGORIES.map((category) => {
            const price = directoryPriceLabel(category);
            return (
              <li
                key={category.slug}
                className="min-h-0 md:last:col-span-2 md:last:w-[calc((100%-2.5rem)/2)] md:last:justify-self-center lg:last:col-span-1 lg:last:col-start-2 lg:last:w-auto lg:last:justify-self-stretch"
              >
                <Link
                  href={category.path}
                  className="group flex h-full flex-col border border-gray-line/70 bg-ivory px-7 py-8 transition duration-300 hover:border-champagne/80 hover:bg-white/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne motion-reduce:transition-none md:min-h-[13.5rem] md:px-8 md:py-9"
                >
                  <h2 className="font-display text-2xl leading-tight text-ink md:text-3xl">
                    {category.directoryName}
                  </h2>
                  <p className="font-body mt-3 text-sm leading-relaxed text-taupe md:text-base">
                    {category.directoryDescription}
                  </p>
                  <div className="mt-auto flex items-end justify-between gap-4 pt-8">
                    {price ? (
                      <p className="font-body text-base text-ink">{price}</p>
                    ) : (
                      <span />
                    )}
                    <span className="font-body inline-flex min-h-[44px] items-center text-[12px] font-medium uppercase tracking-[0.16em] text-ink">
                      Explore
                      <span className="ml-1.5 inline-block transition-transform duration-300 group-hover:translate-x-1 motion-reduce:transition-none">
                        →
                      </span>
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </Container>
    </section>
  );
}

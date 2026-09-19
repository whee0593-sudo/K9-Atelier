import Link from "next/link";
import { Container } from "@/components/luxury/Container";
import {
  SERVICE_CATEGORIES,
  directoryPriceLabel,
} from "@/lib/service-page";

export function ServiceDirectory() {
  return (
    <section aria-label="Service directory" className="bg-ivory pb-20 pt-2 md:pb-24 md:pt-3 lg:pb-28">
      <Container>
        <ul className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8 lg:grid-cols-3 lg:gap-x-8 lg:gap-y-10">
          {SERVICE_CATEGORIES.map((category) => {
            const price = directoryPriceLabel(category);
            return (
              <li
                key={category.slug}
                className="min-h-0 md:last:col-span-2 md:last:w-[calc((100%-2rem)/2)] md:last:justify-self-center lg:last:col-span-1 lg:last:col-start-2 lg:last:w-auto lg:last:justify-self-stretch"
              >
                <Link
                  href={category.path}
                  className="group flex h-full flex-col border border-gray-line bg-ivory px-7 py-8 transition duration-500 hover:border-champagne focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne motion-reduce:transition-none md:px-8 md:py-9"
                >
                  <h2 className="font-display text-[1.75rem] leading-[1.15] font-medium text-ink md:text-3xl">
                    {category.directoryName}
                  </h2>
                  <p className="font-body mt-3 text-base leading-[1.65] text-taupe">
                    {category.directoryDescription}
                  </p>
                  {price ? (
                    <p className="font-body mt-5 min-h-[1.5rem] text-base font-medium tracking-[0.01em] text-ink md:min-h-[1.7rem] md:text-[17px]">
                      {price}
                    </p>
                  ) : (
                    <div
                      className="mt-5 min-h-[1.5rem] md:min-h-[1.7rem]"
                      aria-hidden="true"
                    />
                  )}
                  <span className="font-body mt-auto inline-flex min-h-[48px] items-center pt-7 text-[12px] font-medium uppercase tracking-[0.16em] text-deep-lavender transition duration-500 group-hover:text-ink motion-reduce:transition-none md:pt-8">
                    Explore
                    <span
                      aria-hidden="true"
                      className="ml-1.5 inline-block transition-transform duration-500 group-hover:translate-x-1 motion-reduce:transition-none"
                    >
                      →
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </Container>
    </section>
  );
}

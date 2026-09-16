import Link from "next/link";
import { Container } from "@/components/luxury/Container";
import {
  SERVICE_CATEGORIES,
  directoryPriceLabel,
} from "@/lib/service-page";

export function ServiceDirectory() {
  return (
    <section aria-label="Service directory" className="bg-ivory pb-16 md:pb-24">
      <Container>
        <ul className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {SERVICE_CATEGORIES.map((category) => {
            const price = directoryPriceLabel(category);
            return (
              <li
                key={category.slug}
                className="min-h-0 md:last:col-span-2 md:last:w-[calc((100%-2rem)/2)] md:last:justify-self-center lg:last:col-span-1 lg:last:col-start-2 lg:last:w-auto lg:last:justify-self-stretch"
              >
                <Link
                  href={category.path}
                  className="group flex h-full flex-col border border-gray-line/80 bg-ivory p-8 transition duration-500 hover:border-champagne focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne motion-reduce:transition-none"
                >
                  <h2 className="font-display text-3xl text-ink">
                    {category.directoryName}
                  </h2>
                  <p className="font-body mt-4 flex-1 text-sm leading-relaxed text-taupe">
                    {category.directoryDescription}
                  </p>
                  {price ? (
                    <p className="font-body mt-6 text-[12px] font-medium uppercase tracking-[0.14em] text-taupe">
                      {price}
                    </p>
                  ) : null}
                  <span className="font-body mt-6 inline-flex min-h-[48px] items-center text-[11px] font-medium uppercase tracking-[0.16em] text-deep-lavender transition duration-500 group-hover:text-ink motion-reduce:transition-none">
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

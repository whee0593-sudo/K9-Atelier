import Link from "next/link";
import { Container } from "@/components/luxury/Container";
import {
  SERVICE_CATEGORIES,
  directoryPriceLabel,
} from "@/lib/service-page";
import {
  servicesBodyClass,
  servicesCategoryTitleClass,
  servicesCtaClass,
  servicesPriceClass,
} from "@/components/services/services-type";

export function ServiceDirectory() {
  return (
    <section aria-label="Service directory" className="bg-ivory pb-20 md:pb-28">
      <Container>
        <ul className="grid grid-cols-1 gap-x-8 gap-y-10 md:grid-cols-2 lg:grid-cols-3">
          {SERVICE_CATEGORIES.map((category) => {
            const price = directoryPriceLabel(category);
            return (
              <li
                key={category.slug}
                className="min-h-0 md:last:col-span-2 md:last:w-[calc((100%-2rem)/2)] md:last:justify-self-center lg:last:col-span-1 lg:last:col-start-2 lg:last:w-auto lg:last:justify-self-stretch"
              >
                <Link
                  href={category.path}
                  className="group flex h-full flex-col border border-gray-line/80 bg-ivory px-7 py-8 transition duration-500 hover:border-champagne focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne motion-reduce:transition-none md:px-8 md:py-10"
                >
                  <h2 className={servicesCategoryTitleClass}>
                    {category.directoryName}
                  </h2>
                  <p className={`${servicesBodyClass} mt-5`}>
                    {category.directoryDescription}
                  </p>
                  <div className="mt-auto pt-8">
                    <p className={servicesPriceClass}>{price ?? ""}</p>
                    <span
                      className={`${servicesCtaClass} mt-4 transition duration-500 group-hover:text-ink motion-reduce:transition-none`}
                    >
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
          })}
        </ul>
      </Container>
    </section>
  );
}

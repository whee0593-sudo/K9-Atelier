"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SERVICES_NAV } from "@/lib/service-page";

const inactiveClass =
  "inline-flex min-h-[56px] w-full items-center justify-center rounded-sm border border-gray-line/80 bg-ivory px-3 py-3 text-center font-body text-[11px] font-medium uppercase leading-tight tracking-[0.12em] text-taupe transition hover:border-champagne hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne sm:min-h-[60px] sm:px-3 sm:text-[12px] lg:px-2 xl:px-3";

const activeClass =
  "inline-flex min-h-[56px] w-full items-center justify-center rounded-sm border border-deep-lavender bg-deep-lavender px-3 py-3 text-center font-body text-[11px] font-medium uppercase leading-tight tracking-[0.12em] text-ivory transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne sm:min-h-[60px] sm:px-3 sm:text-[12px] lg:px-2 xl:px-3";

export function ServicesNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Service categories"
      className="sticky top-[5.4rem] z-40 border-y border-gray-line/80 bg-ivory/95 backdrop-blur-sm md:top-[5.9rem]"
    >
      <div className="mx-auto max-w-[1240px] px-5 py-3 md:px-12 md:py-4 xl:px-20">
        <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 xl:grid-cols-7">
          {SERVICES_NAV.map((item) => {
            const isActive = item.href === pathname;
            return (
              <li
                key={item.href}
                className="last:col-span-2 last:mx-auto last:w-[calc(50%-0.3125rem)] sm:last:col-span-1 sm:last:col-start-2 sm:last:mx-0 sm:last:w-auto xl:last:col-start-auto"
              >
                <Link
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={isActive ? activeClass : inactiveClass}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}

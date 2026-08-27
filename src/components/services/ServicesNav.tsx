"use client";

import { SERVICES_NAV } from "@/lib/service-page";

export function ServicesNav() {
  return (
    <nav
      aria-label="Service categories"
      className="sticky top-[5.4rem] z-40 border-y border-gray-line/80 bg-ivory/95 backdrop-blur-sm md:top-[5.9rem]"
    >
      <div className="mx-auto max-w-[1240px] px-5 md:px-12 xl:px-20">
        <ul className="flex gap-2 overflow-x-auto py-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {SERVICES_NAV.map((item) => (
            <li key={item.href} className="shrink-0">
              <a
                href={item.href}
                className="inline-flex min-h-[44px] items-center whitespace-nowrap rounded-sm border border-gray-line/80 bg-ivory px-4 font-body text-[10px] font-medium uppercase tracking-[0.14em] text-taupe transition hover:border-champagne hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne"
              >
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}

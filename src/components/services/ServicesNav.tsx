"use client";

import { useEffect, useState } from "react";
import { SERVICES_NAV } from "@/lib/service-page";

const inactiveClass =
  "inline-flex min-h-[56px] w-full items-center justify-center rounded-sm border border-gray-line/80 bg-ivory px-3 py-3 text-center font-body text-[11px] font-medium uppercase leading-tight tracking-[0.12em] text-taupe transition hover:border-champagne hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne sm:min-h-[60px] sm:px-4 sm:text-[12px]";

const activeClass =
  "inline-flex min-h-[56px] w-full items-center justify-center rounded-sm border border-deep-lavender bg-deep-lavender px-3 py-3 text-center font-body text-[11px] font-medium uppercase leading-tight tracking-[0.12em] text-ivory transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne sm:min-h-[60px] sm:px-4 sm:text-[12px]";

type NavHref = (typeof SERVICES_NAV)[number]["href"];

export function ServicesNav() {
  const [active, setActive] = useState<NavHref>(SERVICES_NAV[0].href);

  useEffect(() => {
    const updateActive = () => {
      const offset = 200;
      let current: NavHref = SERVICES_NAV[0].href;
      for (const item of SERVICES_NAV) {
        const el = document.getElementById(item.href.slice(1));
        if (!el) continue;
        if (el.getBoundingClientRect().top - offset <= 0) {
          current = item.href;
        }
      }
      setActive(current);
    };

    updateActive();
    window.addEventListener("scroll", updateActive, { passive: true });
    window.addEventListener("hashchange", updateActive);
    return () => {
      window.removeEventListener("scroll", updateActive);
      window.removeEventListener("hashchange", updateActive);
    };
  }, []);

  return (
    <nav
      aria-label="Service categories"
      className="sticky top-[5.4rem] z-40 border-y border-gray-line/80 bg-ivory/95 backdrop-blur-sm md:top-[5.9rem]"
    >
      <div className="mx-auto max-w-[1240px] px-5 py-3 md:px-12 md:py-4 xl:px-20">
        <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
          {SERVICES_NAV.map((item) => {
            const isActive = active === item.href;
            return (
              <li key={item.href}>
                <a
                  href={item.href}
                  aria-current={isActive ? "location" : undefined}
                  className={isActive ? activeClass : inactiveClass}
                  onClick={() => setActive(item.href)}
                >
                  {item.label}
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}

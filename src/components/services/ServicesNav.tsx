"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  SERVICES_NAV,
  SERVICES_PATH,
  isServicesCategoryRoute,
} from "@/lib/service-page";

const inactiveClass =
  "inline-flex min-h-[56px] w-full items-center justify-center rounded-sm border border-gray-line/80 bg-ivory px-3 py-3 text-center font-body text-[11px] font-medium uppercase leading-tight tracking-[0.12em] text-taupe transition hover:border-champagne hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne sm:min-h-[60px] sm:px-4 sm:text-[12px]";

const activeClass =
  "inline-flex min-h-[56px] w-full items-center justify-center rounded-sm border border-deep-lavender bg-deep-lavender px-3 py-3 text-center font-body text-[11px] font-medium uppercase leading-tight tracking-[0.12em] text-ivory transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne sm:min-h-[60px] sm:px-4 sm:text-[12px]";

type NavHref = (typeof SERVICES_NAV)[number]["href"];

function navHrefForPath(href: NavHref, pathname: string) {
  if (pathname === SERVICES_PATH && href.startsWith(`${SERVICES_PATH}#`)) {
    return `#${href.slice(`${SERVICES_PATH}#`.length)}`;
  }
  return href;
}

export function ServicesNav() {
  const pathname = usePathname();
  const routedActive = SERVICES_NAV.find((item) => item.href === pathname)?.href;
  const [hashActive, setHashActive] = useState<NavHref>(SERVICES_NAV[0].href);

  useEffect(() => {
    if (routedActive) return;

    const updateActive = () => {
      const offset = 200;
      let current: NavHref = SERVICES_NAV[0].href;
      for (const item of SERVICES_NAV) {
        const el = document.getElementById(item.sectionId);
        if (!el) continue;
        if (el.getBoundingClientRect().top - offset <= 0) {
          current = item.href;
        }
      }
      setHashActive(current);
    };

    updateActive();
    window.addEventListener("scroll", updateActive, { passive: true });
    window.addEventListener("hashchange", updateActive);
    return () => {
      window.removeEventListener("scroll", updateActive);
      window.removeEventListener("hashchange", updateActive);
    };
  }, [routedActive]);

  const active = routedActive ?? hashActive;

  return (
    <nav
      aria-label="Service categories"
      className="sticky top-[5.4rem] z-40 border-y border-gray-line/80 bg-ivory/95 backdrop-blur-sm md:top-[5.9rem]"
    >
      <div className="mx-auto max-w-[1240px] px-5 py-3 md:px-12 md:py-4 xl:px-20">
        <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
          {SERVICES_NAV.map((item) => {
            const isActive = active === item.href;
            const href = navHrefForPath(item.href, pathname);
            return (
              <li key={item.href}>
                <Link
                  href={href}
                  aria-current={
                    isActive
                      ? isServicesCategoryRoute(item.href)
                        ? "page"
                        : "location"
                      : undefined
                  }
                  className={isActive ? activeClass : inactiveClass}
                  onClick={() => {
                    if (!routedActive) setHashActive(item.href);
                  }}
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

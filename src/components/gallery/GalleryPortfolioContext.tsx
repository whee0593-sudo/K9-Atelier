import Link from "next/link";
import {
  GALLERY_CONTEXT_BODY,
  GALLERY_CONTEXT_HEADING,
  GALLERY_SERVICE_LINKS,
} from "@/lib/gallery-page";

const textLinkClass =
  "font-body inline-flex min-h-[48px] items-center justify-center text-[12px] font-medium uppercase tracking-[0.16em] text-deep-lavender transition hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne";

export function GalleryPortfolioContext() {
  return (
    <section
      aria-labelledby="gallery-craft"
      className="mx-auto mt-16 max-w-2xl border-t border-gray-line/80 pt-12 text-center md:mt-20 md:pt-16"
    >
      <h2
        id="gallery-craft"
        className="font-display text-2xl font-medium text-ink md:text-3xl"
      >
        {GALLERY_CONTEXT_HEADING}
      </h2>
      <p className="font-body mx-auto mt-4 max-w-xl text-sm leading-relaxed text-taupe md:text-[15px]">
        {GALLERY_CONTEXT_BODY}
      </p>
      <ul className="mt-8 flex list-none flex-wrap items-center justify-center gap-x-8 gap-y-1">
        {GALLERY_SERVICE_LINKS.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className={textLinkClass}>
              {link.label}
              <span aria-hidden="true" className="ml-1.5">
                →
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

"use client";

import Link from "next/link";
import { business } from "@/lib/business";
import { Container } from "@/components/luxury/Container";

const footerLinks = [
  { href: "/#experience", label: "The Atelier" },
  { href: "/services", label: "Services" },
  { href: "/#mobile-salon", label: "Experience" },
  { href: "/about", label: "About" },
  { href: "/faq", label: "FAQ" },
  { href: "/contact", label: "Contact" },
  { href: "/login", label: "Client Login" },
] as const;

export function Footer() {
  const { brand, site } = business;
  const instagram =
    site.underConstruction?.instagramUrl ?? "https://instagram.com/k9atelierfl";
  const instagramHandle =
    site.underConstruction?.instagramHandle ?? "k9AtelierFL";

  return (
    <footer className="border-t border-gray-line bg-dusty-lavender/35">
      <Container className="py-16 md:py-20">
        <div className="grid gap-12 md:grid-cols-[1.2fr_1fr_1fr]">
          <div>
            <p className="font-body text-[12px] font-semibold uppercase tracking-[0.22em] text-ink">
              {brand.name}
            </p>
            <p className="font-body mt-3 text-[12px] font-medium uppercase tracking-[0.16em] text-taupe">
              Private Pet Grooming Salon
            </p>
            <p className="font-body mt-1 text-[12px] font-medium uppercase tracking-[0.16em] text-taupe">
              Palm Beach
            </p>
          </div>

          <div>
            <p className="font-body text-[12px] font-medium uppercase tracking-[0.16em] text-taupe">
              Explore
            </p>
            <ul className="mt-4 space-y-3">
              {footerLinks.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="font-body text-sm text-ink transition hover:text-deep-lavender"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="font-body text-[12px] font-medium uppercase tracking-[0.16em] text-taupe">
              Contact
            </p>
            <a
              href={`mailto:${brand.email}`}
              className="font-body mt-4 block text-sm text-ink transition hover:text-deep-lavender"
            >
              {brand.email}
            </a>
            <a
              href={instagram}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Instagram @${instagramHandle}`}
              className="font-body mt-3 block text-sm text-ink transition hover:text-deep-lavender"
            >
              <span className="text-taupe">Instagram · </span>@{instagramHandle}
            </a>
            <a
              href={brand.social.facebookUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Facebook ${brand.social.facebook}`}
              className="font-body mt-3 block text-sm text-ink transition hover:text-deep-lavender"
            >
              <span className="text-taupe">Facebook · </span>
              {brand.social.facebook}
            </a>
          </div>
        </div>

        <div className="mt-14 border-t border-gray-line/80 pt-8">
          <p className="font-body text-center text-xs text-taupe">
            © {new Date().getFullYear()} {brand.name}. All rights reserved.
          </p>
        </div>
      </Container>
    </footer>
  );
}

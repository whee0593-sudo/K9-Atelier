"use client";

import Link from "next/link";
import {
  business,
  getBrandInstagramUrl,
  getBrandPhoneTelHref,
  getBrandSearchName,
  getGoogleWriteReviewUrl,
} from "@/lib/business";
import { Container } from "@/components/luxury/Container";

const footerLinks = [
  { href: "/#experience", label: "The Atelier" },
  { href: "/services", label: "Services" },
  { href: "/reviews", label: "Reviews" },
  { href: "/about", label: "About" },
  { href: "/faq", label: "FAQ" },
  { href: "/referrals", label: "Referral Rewards" },
  { href: "/contact", label: "Contact" },
] as const;

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatTime(value: string) {
  const [hStr, mStr] = value.split(":");
  const hour = Number(hStr);
  const minute = mStr ?? "00";
  const period = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${minute} ${period}`;
}

export function Footer() {
  const { brand, booking } = business;
  const phoneHref = getBrandPhoneTelHref();
  const instagram =
    getBrandInstagramUrl() ?? "https://instagram.com/k9atelierfl";
  const instagramHandle = "K9AtelierFL";
  const days = booking.availableDays;
  const daysLabel =
    days.length > 1
      ? `${capitalize(days[0])}–${capitalize(days[days.length - 1])}`
      : capitalize(days[0] ?? "");
  const hoursLabel = `${formatTime(booking.hoursStart)}–${formatTime(
    booking.hoursEnd,
  )}`;

  return (
    <footer className="border-t border-gray-line bg-dusty-lavender/35">
      <Container className="py-16 md:py-20">
        <div className="grid gap-12 md:grid-cols-[1.2fr_1fr]">
          <div>
            <p className="font-body text-[12px] font-semibold uppercase tracking-[0.14em] text-ink">
              {getBrandSearchName()}
            </p>
            <p className="font-body mt-3 text-[12px] font-medium leading-relaxed text-taupe">
              Private, cage-free mobile dog grooming for dogs under 45 lbs.
            </p>
            <p className="font-body mt-1.5 text-[12px] font-medium leading-relaxed text-taupe">
              Serving Jupiter, Palm Beach Gardens & West Palm Beach.
            </p>
            {brand.phone && phoneHref ? (
              <a
                href={phoneHref}
                className="font-body mt-5 block text-sm text-ink transition hover:text-deep-lavender"
              >
                {brand.phone}
              </a>
            ) : null}
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
            {getGoogleWriteReviewUrl() ? (
              <a
                href={getGoogleWriteReviewUrl() ?? undefined}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Review K9 Atelier on Google"
                className="font-body mt-3 block text-sm text-ink transition hover:text-deep-lavender"
              >
                <span className="text-taupe">Google · </span>
                Review K9 Atelier
              </a>
            ) : null}
            <p className="font-body mt-5 text-sm text-ink">
              {daysLabel} · {hoursLabel} Eastern
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
        </div>

        <div className="mt-14 border-t border-gray-line/80 pt-8">
          <p className="font-body text-center text-xs text-taupe">
            © {new Date().getFullYear()} {brand.name}. All rights reserved.
            {" · "}
            <Link
              href="/privacy"
              className="underline decoration-champagne/70 underline-offset-4 hover:text-deep-lavender"
            >
              Privacy Policy
            </Link>
            {" · "}
            <Link
              href="/terms"
              className="underline decoration-champagne/70 underline-offset-4 hover:text-deep-lavender"
            >
              Terms
            </Link>
          </p>
        </div>
      </Container>
    </footer>
  );
}

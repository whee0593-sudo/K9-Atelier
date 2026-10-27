"use client";

import React from "react";
import Link from "next/link";
import { PhoneIcon } from "@/components/icons/PhoneIcon";
import { Container } from "@/components/luxury/Container";
import type { SiteChrome } from "@/lib/site-chrome";

const footerLinks = [
  { href: "/", label: "The Atelier" },
  { href: "/services", label: "Services" },
  { href: "/gallery", label: "Our Work" },
  { href: "/reviews", label: "Reviews" },
  { href: "/about", label: "About" },
  { href: "/faq", label: "FAQ" },
  { href: "/referrals", label: "Referral Rewards" },
  { href: "/contact", label: "Contact" },
] as const;

export function Footer({ chrome }: { chrome: SiteChrome }) {
  const instagramHandle = "K9AtelierFL";

  return (
    <footer className="border-t border-gray-line bg-dusty-lavender/35">
      <Container className="py-16 md:py-20">
        <div className="grid gap-12 md:grid-cols-[1.2fr_1fr]">
          <div>
            <p className="font-body text-[12px] font-bold uppercase tracking-[0.14em] text-[#382440]">
              {chrome.searchName}
            </p>
            <p className="font-body mt-3 text-[12px] font-medium leading-relaxed text-taupe">
              Private, cage-free mobile dog grooming for dogs up to 45 lbs.
            </p>
            <p className="font-body mt-1.5 text-pretty text-[12px] font-medium leading-relaxed text-taupe">
              Serving{" "}
              <span className="whitespace-nowrap">Jupiter Island,</span>{" "}
              <span className="whitespace-nowrap">Jupiter,</span>
              <br className="min-[375px]:hidden" />{" "}
              <span className="whitespace-nowrap">Tequesta,</span>{" "}
              <span className="whitespace-nowrap">Palm Beach Gardens &</span>{" "}
              <span className="whitespace-nowrap">Palm Beach.</span>
            </p>
            {chrome.phone && chrome.phoneHref ? (
              <a
                href={chrome.phoneHref}
                className="font-body mt-5 inline-flex min-h-[44px] items-center gap-2 text-sm font-bold text-[#382440] transition hover:text-deep-lavender"
              >
                <PhoneIcon />
                {chrome.phoneDisplay}
              </a>
            ) : null}
            <a
              href={chrome.instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Instagram @${instagramHandle}`}
              className="font-body mt-3 block text-sm font-bold text-[#382440] transition hover:text-deep-lavender"
            >
              <span>Instagram · </span>@{instagramHandle}
            </a>
            <a
              href={chrome.facebookUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Facebook ${chrome.facebookLabel}`}
              className="font-body mt-3 block text-sm font-bold text-[#382440] transition hover:text-deep-lavender"
            >
              <span>Facebook · </span>
              {chrome.facebookLabel}
            </a>
            {chrome.googleReviewUrl ? (
              <a
                href={chrome.googleReviewUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Review K9 Atelier on Google"
                className="font-body mt-3 block text-sm font-bold text-[#382440] transition hover:text-deep-lavender"
              >
                <span>Google · </span>
                Review K9 Atelier
              </a>
            ) : null}
            <p className="font-body mt-5 text-sm text-ink">
              {chrome.daysLabel} · {chrome.hoursLabel}
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
            © {new Date().getFullYear()} {chrome.name}. All rights reserved.
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

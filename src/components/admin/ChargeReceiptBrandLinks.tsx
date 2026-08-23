"use client";

import Link from "next/link";
import {
  getBookAgainPath,
  getBrandInstagramUrl,
  getBrandWebsiteUrl,
  getGoogleProfileUrl,
  getGoogleWriteReviewUrl,
} from "@/lib/business";
import { storeConcernContext } from "@/lib/support-concern";

const buttonClass =
  "inline-flex min-h-11 w-full items-center justify-center rounded-[8px] border border-[#756578] bg-[#FFFDFC] px-2 text-[13px] text-[#756578] transition hover:bg-[#756578]/10 active:bg-[#756578]/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#756578]/40 focus-visible:ring-offset-2";

export function ChargeReceiptBrandLinks({
  appointmentId,
  chargeId,
  websiteUrl,
  instagramUrl,
  googleReviewUrl,
}: {
  appointmentId: string;
  chargeId: string;
  websiteUrl?: string;
  instagramUrl?: string | null;
  googleReviewUrl?: string | null;
}) {
  const siteUrl = websiteUrl || getBrandWebsiteUrl();
  const instagram = instagramUrl ?? getBrandInstagramUrl();
  const google =
    googleReviewUrl ?? getGoogleWriteReviewUrl() ?? getGoogleProfileUrl();

  const buttons = [
    { href: siteUrl, label: "Website", external: true },
    instagram ? { href: instagram, label: "Instagram", external: true } : null,
    google ? { href: google, label: "Review", external: true } : null,
    { href: getBookAgainPath(), label: "Book Again", external: false },
  ].filter((item): item is { href: string; label: string; external: boolean } =>
    Boolean(item),
  );

  return (
    <div className="mt-5">
      <div
        className={`grid gap-2 ${
          buttons.length === 4
            ? "grid-cols-2"
            : buttons.length === 3
              ? "grid-cols-3"
              : buttons.length === 2
                ? "grid-cols-2"
                : "grid-cols-1"
        }`}
      >
        {buttons.map((button) => (
          <a
            key={button.label}
            href={button.href}
            target={button.external ? "_blank" : undefined}
            rel={button.external ? "noopener noreferrer" : undefined}
            className={buttonClass}
          >
            {button.label}
          </a>
        ))}
      </div>
      <div className="mt-4 text-center">
        <Link
          href="/contact?topic=concern"
          onClick={() =>
            storeConcernContext({
              appointmentId,
              chargeId,
            })
          }
          className="font-body inline-flex min-h-11 items-center justify-center text-sm text-[#756578] underline decoration-[#756578]/50 underline-offset-4 hover:text-[#635366] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#756578]/40 focus-visible:ring-offset-2"
        >
          Report a Concern
        </Link>
      </div>
    </div>
  );
}

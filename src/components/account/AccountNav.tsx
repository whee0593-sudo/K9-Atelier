"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { accountConfig } from "@/lib/account-fields";
import type { AccountNavSummaries } from "@/lib/account-nav-summaries";
import { emptyAccountNavSummaries } from "@/lib/account-nav-summaries";

function isActivePath(pathname: string, href: string, sectionId?: string) {
  if (pathname === href) return true;
  return (
    sectionId === "bookings" && pathname.startsWith("/account/appointments/")
  );
}

function summaryForSection(
  sectionId: string,
  summaries: AccountNavSummaries,
): string | null {
  if (sectionId === "password") return null;
  if (
    sectionId === "overview" ||
    sectionId === "profile" ||
    sectionId === "addresses" ||
    sectionId === "pets" ||
    sectionId === "payment" ||
    sectionId === "referrals" ||
    sectionId === "bookings"
  ) {
    return summaries[sectionId];
  }
  return null;
}

function NavRow({
  href,
  label,
  summary,
  active,
}: {
  href: string;
  label: string;
  summary?: string | null;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      aria-label={summary ? `${label}, ${summary}` : label}
      className={`flex items-center justify-between gap-3 rounded-lg px-4 py-2.5 text-sm transition ${
        active
          ? "bg-lavender-light font-medium text-gold-dark"
          : "text-text-muted hover:bg-lavender-light/60 hover:text-text"
      }`}
    >
      <span className="shrink-0">{label}</span>
      {summary ? (
        <span className="min-w-0 truncate text-right text-xs font-normal tracking-wide text-text-muted">
          {summary}
        </span>
      ) : null}
    </Link>
  );
}

export function AccountNavLinks({
  pathname,
  summaries = emptyAccountNavSummaries(),
}: {
  pathname: string;
  summaries?: AccountNavSummaries;
}) {
  return (
    <nav className="flex flex-col gap-1" aria-label="Account">
      <NavRow
        href="/account"
        label="Overview"
        summary={summaries.overview}
        active={pathname === "/account"}
      />
      {accountConfig.sections.map((section) => (
        <NavRow
          key={section.id}
          href={section.path}
          label={section.title}
          summary={summaryForSection(section.id, summaries)}
          active={isActivePath(pathname, section.path, section.id)}
        />
      ))}
    </nav>
  );
}

export function AccountNav({
  summaries = emptyAccountNavSummaries(),
}: {
  summaries?: AccountNavSummaries;
}) {
  const pathname = usePathname();
  return <AccountNavLinks pathname={pathname} summaries={summaries} />;
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const links = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/communication", label: "Communication" },
  { href: "/admin/vaccinations", label: "Vaccination Review" },
  { href: "/admin/appointments", label: "Calendar" },
  { href: "/admin/finance", label: "Finance" },
  { href: "/admin/referrals", label: "Referrals" },
  { href: "/admin/messages", label: "Contact Customer" },
  { href: "/admin/pets", label: "Customers & Pets" },
  { href: "/admin/book-for-customer", label: "Book for Customer" },
  { href: "/admin/profile", label: "My Admin Profile" },
];

export function AdminNav({
  showTeam = false,
  unreadCount = 0,
}: {
  showTeam?: boolean;
  unreadCount?: number;
}) {
  const pathname = usePathname();
  const [badge, setBadge] = useState(unreadCount);
  const items = showTeam
    ? [...links, { href: "/admin/team", label: "Admin Team" }]
    : links;

  useEffect(() => {
    setBadge(unreadCount);
  }, [unreadCount]);

  useEffect(() => {
    let stop = false;
    async function refresh() {
      try {
        const response = await fetch("/api/admin/communication/unread", {
          credentials: "include",
        });
        if (!response.ok) return;
        const body = (await response.json()) as { count?: number };
        if (!stop && typeof body.count === "number") setBadge(body.count);
      } catch {
        // The nav still shows the last count.
      }
    }
    const timer = window.setInterval(() => void refresh(), 20000);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, []);

  return (
    <nav className="flex flex-col gap-1">
      {items.map((link) => {
        const active =
          link.href === "/admin"
            ? pathname === "/admin"
            : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded-lg px-4 py-2.5 text-sm transition ${
              active
                ? "bg-lavender-light font-medium text-gold-dark"
                : "text-text-muted hover:bg-lavender-light/60 hover:text-text"
            }`}
          >
            {link.label}
            {link.href === "/admin/communication" && badge > 0 ? (
              <span className="ml-2 font-semibold text-ink">{badge}</span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

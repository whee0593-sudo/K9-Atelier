"use client";

import { usePathname } from "next/navigation";
import { AuthRecoveryRedirect } from "@/components/auth/AuthRecoveryRedirect";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import type { SiteChrome } from "@/lib/site-chrome";

const BARE_PATHS = ["/under-construction", "/login/admin"];

export function SiteShell({
  children,
  chrome,
}: {
  children: React.ReactNode;
  chrome: SiteChrome;
}) {
  const pathname = usePathname();
  const bare =
    BARE_PATHS.includes(pathname) ||
    pathname.startsWith("/admin/collect") ||
    pathname.startsWith("/admin/arrive") ||
    pathname === "/admin/appointments/preview" ||
    pathname === "/admin/appointments/preview/on-the-way" ||
    pathname === "/admin/appointments/preview/change" ||
    pathname === "/admin/appointments/preview/change-emails" ||
    pathname === "/admin/finance/preview";

  if (bare) {
    return (
      <>
        <AuthRecoveryRedirect />
        {children}
      </>
    );
  }

  return (
    <>
      <AuthRecoveryRedirect />
      <Header logo={chrome.logo} name={chrome.name} />
      <main>{children}</main>
      <Footer chrome={chrome} />
    </>
  );
}

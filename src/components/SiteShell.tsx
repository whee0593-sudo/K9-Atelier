"use client";

import { usePathname } from "next/navigation";
import { AuthRecoveryRedirect } from "@/components/auth/AuthRecoveryRedirect";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";

const BARE_PATHS = ["/under-construction", "/login/admin"];

export function SiteShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const bare =
    BARE_PATHS.includes(pathname) ||
    pathname.startsWith("/admin/collect") ||
    pathname.startsWith("/admin/arrive") ||
    pathname === "/admin/appointments/preview" ||
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
      <Header />
      <main>{children}</main>
      <Footer />
    </>
  );
}

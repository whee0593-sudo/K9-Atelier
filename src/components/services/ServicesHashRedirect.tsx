"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { SERVICES_HASH_ROUTES } from "@/lib/service-page";

export function ServicesHashRedirect() {
  const router = useRouter();

  useEffect(() => {
    const applyHashRoute = () => {
      const hash = window.location.hash.replace(/^#/, "");
      const dest = SERVICES_HASH_ROUTES[hash];
      if (dest) router.replace(dest);
    };

    applyHashRoute();
    window.addEventListener("hashchange", applyHashRoute);
    return () => window.removeEventListener("hashchange", applyHashRoute);
  }, [router]);

  return null;
}

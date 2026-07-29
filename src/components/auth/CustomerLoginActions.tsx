"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { setCustomerLoggedIn } from "@/lib/customer-session";

type Props = {
  next?: string;
  bookingFlow?: boolean;
};

export function CustomerLoginActions({ next, bookingFlow }: Props) {
  const router = useRouter();
  const destination =
    next && next.startsWith("/") && !next.startsWith("//") ? next : "/account";

  function handleCustomerLogin() {
    setCustomerLoggedIn();
    router.push(destination);
  }

  return (
    <div className="mt-10 space-y-4">
      <button
        type="button"
        onClick={handleCustomerLogin}
        className="flex min-h-[4rem] w-full flex-col items-center justify-center rounded-2xl bg-gold px-8 py-4 text-lg font-medium text-white transition hover:bg-gold-dark"
      >
        Customer Login
        <span className="mt-1 text-sm font-normal opacity-90">
          {bookingFlow ? "Continue to booking" : "Preview my account"}
        </span>
      </button>
      <Link
        href="/login/admin"
        className="flex min-h-[4rem] flex-col items-center justify-center rounded-2xl border-2 border-gold bg-cream px-8 py-4 text-lg font-medium text-gold-dark transition hover:bg-lavender-light"
      >
        Admin Login
        <span className="mt-1 text-sm font-normal text-text-muted">
          K9 Atelier team only
        </span>
      </Link>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Props = {
  className?: string;
  redirectTo?: string;
};

export function CustomerSignOutButton({ className = "", redirectTo = "/login" }: Props) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    setError(false);
    try {
      const { error: signOutError } = await createClient().auth.signOut();
      if (signOutError) throw signOutError;
      router.replace(redirectTo);
      router.refresh();
    } catch {
      setError(true);
      setSigningOut(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleSignOut}
        disabled={signingOut}
        className={`font-body inline-flex min-h-[44px] shrink-0 items-center justify-center px-2 text-xs text-taupe underline transition hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-champagne/60 focus-visible:ring-offset-2 focus-visible:ring-offset-ivory ${className}`}
      >
        {signingOut ? "Signing out…" : "Sign Out"}
      </button>
      {error ? <span role="alert">Could not sign out. Please try again.</span> : null}
    </>
  );
}

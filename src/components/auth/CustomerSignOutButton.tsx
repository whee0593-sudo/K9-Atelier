"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Props = {
  className?: string;
};

export function CustomerSignOutButton({ className = "" }: Props) {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      className={`font-body inline-flex min-h-[44px] shrink-0 items-center justify-center px-2 text-xs text-taupe underline transition hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-champagne/60 focus-visible:ring-offset-2 focus-visible:ring-offset-ivory ${className}`}
    >
      Sign Out
    </button>
  );
}

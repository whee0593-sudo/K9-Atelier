"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function CustomerAuthLink({
  className,
  onNavigate,
}: {
  className?: string;
  onNavigate?: () => void;
}) {
  const [href, setHref] = useState("/login");
  const [label, setLabel] = useState("Login");

  useEffect(() => {
    let subscription: { unsubscribe: () => void } | undefined;

    try {
      const supabase = createClient();

      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) {
          setHref("/account");
          setLabel("My Account");
        }
      });

      const listener = supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user) {
          setHref("/account");
          setLabel("My Account");
        } else {
          setHref("/login");
          setLabel("Login");
        }
      });
      subscription = listener.data.subscription;
    } catch {
      // Preview without Supabase still shows Login.
    }

    return () => subscription?.unsubscribe();
  }, []);

  return (
    <Link href={href} onClick={onNavigate} className={className}>
      {label}
    </Link>
  );
}

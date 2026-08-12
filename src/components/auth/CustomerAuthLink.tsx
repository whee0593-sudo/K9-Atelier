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
  const [label, setLabel] = useState("Client Login");

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setHref("/account");
        setLabel("My Account");
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setHref("/account");
        setLabel("My Account");
      } else {
        setHref("/login");
        setLabel("Client Login");
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <Link href={href} onClick={onNavigate} className={className}>
      {label}
    </Link>
  );
}

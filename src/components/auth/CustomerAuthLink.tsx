"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { resolveHeaderAccountDestination } from "@/lib/header-account-link";
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
    let cancelled = false;
    let generation = 0;
    let subscription: { unsubscribe: () => void } | undefined;

    const apply = (destination: { href: string; label: string }) => {
      if (cancelled) return;
      setHref(destination.href);
      setLabel(destination.label);
    };

    try {
      const supabase = createClient();

      const sync = async () => {
        const current = ++generation;
        try {
          const destination = await resolveHeaderAccountDestination({
            getUser: async () => {
              const {
                data: { user },
              } = await supabase.auth.getUser();
              return user ? { email: user.email } : null;
            },
            isStaffUser: async () => {
              const { data, error } = await supabase.rpc("is_staff_user");
              if (error) return null;
              return data === true;
            },
          });
          if (cancelled || current !== generation) return;
          apply(destination);
        } catch {
          if (cancelled || current !== generation) return;
          apply({ href: "/login", label: "Login" });
        }
      };

      void sync();

      const listener = supabase.auth.onAuthStateChange(() => {
        // Defer so getUser does not run inside the auth client's lock.
        setTimeout(() => {
          void sync();
        }, 0);
      });
      subscription = listener.data.subscription;
    } catch {
      // Preview without Supabase still shows Login.
    }

    return () => {
      cancelled = true;
      subscription?.unsubscribe();
    };
  }, []);

  return (
    <Link href={href} onClick={onNavigate} className={className}>
      {label}
    </Link>
  );
}

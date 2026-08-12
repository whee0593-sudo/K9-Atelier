"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Props = {
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
};

export function BookServiceLink({ className, children, onClick }: Props) {
  const [href, setHref] = useState("/login?next=/book");

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setHref("/book");
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setHref(session?.user ? "/book" : "/login?next=/book");
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <Link href={href} className={className} onClick={onClick}>
      {children}
    </Link>
  );
}
